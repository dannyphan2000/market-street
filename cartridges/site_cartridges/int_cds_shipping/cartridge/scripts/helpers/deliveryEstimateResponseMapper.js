'use strict';

var requestBuilder = require('~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder');

function isValidIso(value) {
    return typeof value === 'string' && value.length >= 10;
}

function getDateRange(method) {
    if (method.estimatedDeliveryDate != null &&
        (method.estimatedDeliveryDate.min != null || method.estimatedDeliveryDate.max != null)) {
        return method.estimatedDeliveryDate;
    }
    var shipDate = method.estimatedShipDate;
    return shipDate && (shipDate.min != null || shipDate.max != null) ? shipDate : undefined;
}

function getGroupItems(response) {
    var items = [];
    var estimates = response && response.deliveryEstimates;
    if (!Array.isArray(estimates)) {
        return items;
    }

    for (var i = 0; i < estimates.length; i++) {
        var group = estimates[i].deliveryEstimateGroup;
        if (!Array.isArray(group)) {
            continue;
        }
        for (var j = 0; j < group.length; j++) {
            items.push(group[j]);
        }
    }

    return items;
}

function getProductIds(item) {
    var productIds = {};
    var products = item && item.productDeliveryEstimations;
    if (!Array.isArray(products)) {
        return productIds;
    }

    for (var i = 0; i < products.length; i++) {
        var sku = String(products[i].stockKeepingUnit || '').trim();
        if (sku) {
            productIds[sku] = true;
        }
    }

    return productIds;
}

function buildWindow(method, min, max) {
    return {
        min: min,
        max: max,
        carrier: method.shippingCarrier,
        orderCutoffAt: method.orderCutoffTime,
        method: method
    };
}

function chooseEarlier(existing, candidate) {
    if (!existing) {
        return candidate;
    }
    if (!candidate || !candidate.min) {
        return existing;
    }
    if (!existing.min || candidate.min < existing.min) {
        return candidate;
    }
    return existing;
}

function collectWindowsByProductAndMethod(response) {
    var out = {};
    var items = getGroupItems(response);

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var productIds = getProductIds(item);
        var methods = item.shippingMethods || [];

        for (var j = 0; j < methods.length; j++) {
            var method = methods[j];
            var methodId = String(method.shippingCarrierMethod || '').trim();
            var range = getDateRange(method);
            if (!methodId || !range) {
                continue;
            }

            var min = isValidIso(range.min) ? range.min : range.max;
            var max = isValidIso(range.max) ? range.max : range.min;
            if (!isValidIso(min) || !isValidIso(max)) {
                continue;
            }

            Object.keys(productIds).forEach(function (productId) {
                out[productId] = out[productId] || {};
                out[productId][methodId] = chooseEarlier(out[productId][methodId], buildWindow(method, min, max));
            });
        }
    }

    return out;
}

function setDeliveryWindow(option, window) {
    option.deliveryWindow = {
        startAt: window.min,
        endAt: window.max
    };
}

function applyWindow(option, window) {
    if (window.carrier) {
        option.carrier = window.carrier;
    }
    if (window.orderCutoffAt) {
        option.orderCutoffAt = window.orderCutoffAt;
    }
    setDeliveryWindow(option, window);
}

function mapToResult(response, estimates) {
    var windowsByProductAndMethod = collectWindowsByProductAndMethod(response);
    var normalized = requestBuilder.toArray(estimates);
    var shippingMethodsById = requestBuilder.buildShippingMethodsById();
    var populated = 0;

    for (var i = 0; i < normalized.length; i++) {
        var estimate = normalized[i];
        if (!estimate || !estimate.productId) {
            continue;
        }

        var productId = String(estimate.productId).trim();
        var byMethod = windowsByProductAndMethod[productId] || {};
        var options = requestBuilder.toArray(estimate.shippingOptions);

        for (var j = 0; j < options.length; j++) {
            var option = options[j];
            var resolved = requestBuilder.resolveMethod(option, shippingMethodsById);
            var window = resolved ? byMethod[resolved.methodName] : null;
            if (!window) {
                continue;
            }

            applyWindow(option, window);
            populated++;
        }
    }

    return populated;
}

module.exports = {
    collectWindowsByProductAndMethod: collectWindowsByProductAndMethod,
    mapToResult: mapToResult
};
