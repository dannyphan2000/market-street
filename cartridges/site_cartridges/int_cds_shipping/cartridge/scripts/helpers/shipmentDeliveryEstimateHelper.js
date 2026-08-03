'use strict';

var cdsConfig = require('~/cartridge/scripts/config/cdsShippingConfig');
var requestBuilder = require('~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder');
var Bytes = require('dw/util/Bytes');
var Encoding = require('dw/crypto/Encoding');
var MessageDigest = require('dw/crypto/MessageDigest');

function getAddress(shipment) {
    var address = shipment && shipment.getShippingAddress ? shipment.getShippingAddress() : null;
    if (!address) {
        return null;
    }

    var countryCode = address.countryCode;
    if (countryCode && typeof countryCode.getValue === 'function') {
        countryCode = countryCode.getValue();
    }

    return {
        country: String(countryCode || '').trim(),
        postalCode: String(address.postalCode || '').trim(),
        state: address.stateCode ? String(address.stateCode).trim() : undefined,
        city: address.city ? String(address.city).trim() : undefined
    };
}

function getProducts(shipment) {
    var items = requestBuilder.toArray(shipment && shipment.productLineItems);
    var products = [];

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var sku = String(item && item.productID || '').trim();
        var qty = Number(item && item.quantityValue) || 0;
        if (sku && qty > 0) {
            products.push({
                stockKeepingUnit: sku,
                quantity: qty
            });
        }
    }

    return products;
}

function buildRequestBody(carrier, methodNames, products, address) {
    return {
        deliveryEstimationSetupName: cdsConfig.getDeliveryEstimationSetupName(),
        shippingCarriers: [
            {
                name: carrier,
                methods: methodNames.map(function (methodName) {
                    return { name: methodName };
                })
            }
        ],
        products: products,
        deliveryAddress: address
    };
}

function buildEstimateKey(shipment) {
    var address = getAddress(shipment);
    var products = getProducts(shipment).sort(function (a, b) {
        return a.stockKeepingUnit === b.stockKeepingUnit ?
            a.quantity - b.quantity :
            a.stockKeepingUnit.localeCompare(b.stockKeepingUnit);
    });

    if (!address || !address.country || !address.postalCode || products.length === 0) {
        return '';
    }

    return sha256Hex(JSON.stringify({
        address: {
            country: address.country,
            postalCode: address.postalCode,
            state: address.state || '',
            city: address.city || ''
        },
        products: products
    }));
}

function sha256Hex(value) {
    var digest = new MessageDigest(MessageDigest.DIGEST_SHA_256);
    return Encoding.toHex(digest.digestBytes(new Bytes(value, 'UTF-8')));
}

function buildCarrierList(methodNamesByCarrier) {
    return Object.keys(methodNamesByCarrier).map(function (carrier) {
        return {
            name: carrier,
            methods: methodNamesByCarrier[carrier].map(function (methodName) {
                return { name: methodName };
            })
        };
    });
}

function buildSnapshotRequest(shipment, shippingMethodsById) {
    var address = getAddress(shipment);
    var products = getProducts(shipment);
    var methodNamesByCarrier = {};
    var methodIdByCdsName = {};
    var hasMethods = false;

    if (!address || !address.country || !address.postalCode || products.length === 0) {
        return null;
    }

    Object.keys(shippingMethodsById || {}).forEach(function (methodId) {
        var resolved = requestBuilder.resolveMethod({ shippingMethodId: methodId }, shippingMethodsById);
        if (!resolved) {
            return;
        }

        if (!methodNamesByCarrier[resolved.carrier]) {
            methodNamesByCarrier[resolved.carrier] = [];
        }
        methodNamesByCarrier[resolved.carrier].push(resolved.methodName);
        methodIdByCdsName[resolved.methodName] = methodId;
        hasMethods = true;
    });

    if (!hasMethods) {
        return null;
    }

    return {
        requestBody: {
            deliveryEstimationSetupName: cdsConfig.getDeliveryEstimationSetupName(),
            shippingCarriers: buildCarrierList(methodNamesByCarrier),
            products: products,
            deliveryAddress: address
        },
        methodIdByCdsName: methodIdByCdsName
    };
}

function getSelectedShippingMethodId(shipment) {
    var method = shipment && shipment.getShippingMethod ? shipment.getShippingMethod() : null;
    return method ? String(method.ID || '') : '';
}

function buildCalculateRequest(shipment, shippingMethodsById) {
    var address = getAddress(shipment);
    var products = getProducts(shipment);
    var methodId = getSelectedShippingMethodId(shipment);
    var resolved = requestBuilder.resolveMethod(
        { shippingMethodId: methodId },
        shippingMethodsById || requestBuilder.buildShippingMethodsById()
    );

    if (!address || !address.country || !address.postalCode || products.length === 0 || !resolved) {
        return null;
    }

    return {
        resolvedMethodName: resolved.methodName,
        requestBody: buildRequestBody(resolved.carrier, [resolved.methodName], products, address)
    };
}

function getDateRange(method) {
    if (method.estimatedDeliveryDate != null &&
        (method.estimatedDeliveryDate.min != null || method.estimatedDeliveryDate.max != null)) {
        return method.estimatedDeliveryDate;
    }
    return method.estimatedShipDate;
}

function isValidIso(value) {
    return typeof value === 'string' && value.length >= 10;
}

function getWindowFromMethod(method) {
    var range = getDateRange(method);
    if (!range) {
        return null;
    }

    var min = isValidIso(range.min) ? range.min : range.max;
    var max = isValidIso(range.max) ? range.max : range.min;
    if (!isValidIso(min) || !isValidIso(max)) {
        return null;
    }

    return {
        startAt: new Date(min),
        endAt: new Date(max),
        orderCutoffAt: method.orderCutoffTime ? new Date(method.orderCutoffTime) : null
    };
}

function getWindowForMethod(response, methodName) {
    var estimates = response && response.deliveryEstimates;
    if (!Array.isArray(estimates)) {
        return null;
    }

    for (var i = 0; i < estimates.length; i++) {
        var groups = estimates[i].deliveryEstimateGroup || [];
        for (var j = 0; j < groups.length; j++) {
            var methods = groups[j].shippingMethods || [];
            for (var k = 0; k < methods.length; k++) {
                var method = methods[k];
                if (String(method.shippingCarrierMethod || '').trim() !== methodName) {
                    continue;
                }

                return getWindowFromMethod(method);
            }
        }
    }

    return null;
}

function toIso(value) {
    return value && typeof value.toISOString === 'function' ? value.toISOString() : value;
}

function readSnapshot(shipment) {
    var value = shipment && shipment.custom && shipment.custom.deliveryEstimateSnapshot;
    if (!value) {
        return null;
    }
    if (typeof value === 'object') {
        return value;
    }
    try {
        return JSON.parse(String(value));
    } catch (e) {
        return null;
    }
}

function writeSnapshot(shipment, estimateKey, snapshot) {
    if (!shipment || !shipment.custom || !snapshot) {
        return;
    }
    shipment.custom.deliveryEstimateKey = estimateKey;
    shipment.custom.deliveryEstimateSnapshot = JSON.stringify(snapshot);
}

function addResponseToSnapshot(snapshot, response, methodIdByCdsName) {
    var target = snapshot || { methods: {} };
    var estimates = response && response.deliveryEstimates;
    if (!Array.isArray(estimates)) {
        return target;
    }

    // CDS returns each carrier/fulfillment plan as its own deliveryEstimates entry,
    // split per product into deliveryEstimateGroup[]. Coverage is evaluated per plan:
    // a method is only stored if it serves every split group within its own plan.
    for (var e = 0; e < estimates.length; e++) {
        var groups = estimates[e].deliveryEstimateGroup || [];
        if (groups.length === 0) {
            continue;
        }
        applyPlanAggregates(target, aggregatePlanMethods(groups, methodIdByCdsName), groups.length);
    }

    return target;
}

function aggregatePlanMethods(groups, methodIdByCdsName) {
    var methodAggregates = {};

    for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        var shippingMethods = group.shippingMethods || [];
        for (var j = 0; j < shippingMethods.length; j++) {
            var cdsMethod = shippingMethods[j];
            var methodName = String(cdsMethod.shippingCarrierMethod || '').trim();
            var methodId = methodIdByCdsName[methodName];
            var window = getWindowFromMethod(cdsMethod);
            if (!methodId || !window) {
                continue;
            }

            addGroupWindow(methodAggregates, methodId, group, window);
        }
    }

    return methodAggregates;
}

function applyPlanAggregates(target, methodAggregates, planGroupCount) {
    Object.keys(methodAggregates).forEach(function (methodId) {
        var aggregate = methodAggregates[methodId];
        if (aggregate.groups.length !== planGroupCount) {
            return;
        }
        target.methods[methodId] = mergeMethodSnapshot(target.methods[methodId], aggregate);
    });
}

function mergeMethodSnapshot(existing, aggregate) {
    var candidate = buildMethodSnapshot(aggregate);

    // When the same method is offered by more than one deliveryGroupId plan, the plans
    // are alternative fulfillment routings, not pieces of one shipment. Keep the plan that
    // delivers soonest (earliest endAt, tie-break earliest startAt) instead of widening the
    // window across plans. Within-plan split groups stay conservative (see addGroupWindow).
    if (existing && preferExistingPlan(existing, candidate)) {
        return existing;
    }
    return candidate;
}

function buildMethodSnapshot(aggregate) {
    var methodSnapshot = {
        startAt: toIso(aggregate.startAt),
        endAt: toIso(aggregate.endAt),
        orderCutoffAt: aggregate.orderCutoffAt ? toIso(aggregate.orderCutoffAt) : null
    };
    if (aggregate.groups.length > 1) {
        methodSnapshot.groups = aggregate.groups.slice();
    }
    return methodSnapshot;
}

function preferExistingPlan(existing, candidate) {
    var existingEnd = new Date(existing.endAt).getTime();
    var candidateEnd = new Date(candidate.endAt).getTime();
    if (existingEnd !== candidateEnd) {
        return existingEnd < candidateEnd;
    }
    return new Date(existing.startAt).getTime() <= new Date(candidate.startAt).getTime();
}

function addGroupWindow(methodAggregates, methodId, group, window) {
    if (!methodAggregates[methodId]) {
        methodAggregates[methodId] = {
            startAt: window.startAt,
            endAt: window.endAt,
            orderCutoffAt: window.orderCutoffAt,
            groups: []
        };
    } else {
        methodAggregates[methodId].startAt = earlierDate(methodAggregates[methodId].startAt, window.startAt);
        methodAggregates[methodId].endAt = laterDate(methodAggregates[methodId].endAt, window.endAt);
        methodAggregates[methodId].orderCutoffAt = earlierNullableDate(
            methodAggregates[methodId].orderCutoffAt,
            window.orderCutoffAt
        );
    }

    methodAggregates[methodId].groups.push(buildGroupSnapshot(group, window));
}

function buildGroupSnapshot(group, window) {
    var groupSnapshot = {
        products: getGroupProducts(group),
        startAt: toIso(window.startAt),
        endAt: toIso(window.endAt),
        orderCutoffAt: window.orderCutoffAt ? toIso(window.orderCutoffAt) : null
    };
    var location = getGroupLocation(group);
    if (location) {
        groupSnapshot.location = location;
    }
    return groupSnapshot;
}

function getGroupProducts(group) {
    var products = group && group.productDeliveryEstimations;
    var productIds = [];
    if (!Array.isArray(products)) {
        return productIds;
    }

    for (var i = 0; i < products.length; i++) {
        var productId = String(products[i].stockKeepingUnit || '').trim();
        if (productId) {
            productIds.push(productId);
        }
    }

    return productIds.sort();
}

function getGroupLocation(group) {
    if (!group) {
        return '';
    }

    var location = group.location || group.fulfillmentLocation || group.inventoryLocation;
    if (typeof location === 'string') {
        return location;
    }
    if (location) {
        return String(location.id || location.ID || location.name || '').trim();
    }
    return String(group.locationId || group.fulfillmentLocationId || group.inventoryLocationId || '').trim();
}

function earlierDate(left, right) {
    if (!left) {
        return right;
    }
    if (!right) {
        return left;
    }
    return left.getTime() <= right.getTime() ? left : right;
}

function laterDate(left, right) {
    if (!left) {
        return right;
    }
    if (!right) {
        return left;
    }
    return left.getTime() >= right.getTime() ? left : right;
}

function earlierNullableDate(left, right) {
    if (!left) {
        return right;
    }
    if (!right) {
        return left;
    }
    return earlierDate(left, right);
}

function getSnapshotWindow(snapshot, methodId) {
    var stored = snapshot && snapshot.methods && snapshot.methods[methodId];
    if (!stored || !stored.startAt || !stored.endAt) {
        return null;
    }
    return {
        startAt: new Date(stored.startAt),
        endAt: new Date(stored.endAt),
        orderCutoffAt: stored.orderCutoffAt ? new Date(stored.orderCutoffAt) : null
    };
}

function isExpired(window) {
    return !!(window && window.orderCutoffAt && window.orderCutoffAt.getTime() <= Date.now());
}

function applySnapshotToShipment(shipment, snapshot) {
    var methodId = getSelectedShippingMethodId(shipment);
    var window = getSnapshotWindow(snapshot, methodId);
    if (!window || isExpired(window) || !shipment || !shipment.custom) {
        return 0;
    }

    shipment.custom.deliveryWindowStartAt = window.startAt;
    shipment.custom.deliveryWindowEndAt = window.endAt;
    if (window.orderCutoffAt) {
        shipment.custom.orderCutoffAt = window.orderCutoffAt;
    }
    return 1;
}

function applySnapshotToQuote(snapshot, methods) {
    var populated = 0;
    var normalized = requestBuilder.toArray(methods);

    for (var i = 0; i < normalized.length; i++) {
        var method = normalized[i];
        var window = getSnapshotWindow(snapshot, method && method.id);
        if (!method || !window || isExpired(window)) {
            continue;
        }

        method.deliveryWindow = {
            startAt: window.startAt,
            endAt: window.endAt
        };
        if (window.orderCutoffAt) {
            method.orderCutoffAt = window.orderCutoffAt;
        }
        populated++;
    }
    return populated;
}

module.exports = {
    buildCalculateRequest: buildCalculateRequest,
    buildEstimateKey: buildEstimateKey,
    buildSnapshotRequest: buildSnapshotRequest,
    addResponseToSnapshot: addResponseToSnapshot,
    applySnapshotToQuote: applySnapshotToQuote,
    applySnapshotToShipment: applySnapshotToShipment,
    getAddress: getAddress,
    getProducts: getProducts,
    getSelectedShippingMethodId: getSelectedShippingMethodId,
    readSnapshot: readSnapshot,
    writeSnapshot: writeSnapshot,
    getWindowForMethod: getWindowForMethod
};
