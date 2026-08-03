'use strict';

var cdsConfig = require('~/cartridge/scripts/config/cdsShippingConfig');
var requestBuilder = require('~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder');

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

function buildQuoteRequests(shipment, methods) {
    var address = getAddress(shipment);
    var products = getProducts(shipment);
    var shippingMethodsById = requestBuilder.buildShippingMethodsById();
    var groupsByCarrier = {};
    var groups = [];

    if (!address || !address.country || !address.postalCode || products.length === 0) {
        return groups;
    }

    for (var i = 0; i < methods.length; i++) {
        var method = methods[i];
        var resolved = requestBuilder.resolveMethod({ shippingMethodId: method.id }, shippingMethodsById);
        if (!resolved) {
            continue;
        }

        if (!groupsByCarrier[resolved.carrier]) {
            groupsByCarrier[resolved.carrier] = {
                carrier: resolved.carrier,
                methodByCdsName: {},
                methodNames: []
            };
            groups.push(groupsByCarrier[resolved.carrier]);
        }

        groupsByCarrier[resolved.carrier].methodByCdsName[resolved.methodName] = method;
        groupsByCarrier[resolved.carrier].methodNames.push(resolved.methodName);
    }

    for (var j = 0; j < groups.length; j++) {
        groups[j].requestBody = buildRequestBody(groups[j].carrier, groups[j].methodNames, products, address);
    }

    return groups;
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

function applyQuoteResponse(response, methodByCdsName) {
    var populated = 0;
    var estimates = response && response.deliveryEstimates;
    if (!Array.isArray(estimates)) {
        return populated;
    }

    for (var i = 0; i < estimates.length; i++) {
        var groups = estimates[i].deliveryEstimateGroup || [];
        for (var j = 0; j < groups.length; j++) {
            var shippingMethods = groups[j].shippingMethods || [];
            for (var k = 0; k < shippingMethods.length; k++) {
                var cdsMethod = shippingMethods[k];
                var methodName = String(cdsMethod.shippingCarrierMethod || '').trim();
                var method = methodByCdsName[methodName];
                var window = getWindowFromMethod(cdsMethod);
                if (!method || !window) {
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
        }
    }

    return populated;
}

module.exports = {
    buildCalculateRequest: buildCalculateRequest,
    buildQuoteRequests: buildQuoteRequests,
    applyQuoteResponse: applyQuoteResponse,
    getAddress: getAddress,
    getProducts: getProducts,
    getWindowForMethod: getWindowForMethod
};
