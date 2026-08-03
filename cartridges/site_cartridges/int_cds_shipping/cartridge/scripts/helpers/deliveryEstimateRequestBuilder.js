'use strict';

var cdsConfig = require('~/cartridge/scripts/config/cdsShippingConfig');

function toArray(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value.toArray === 'function') {
        return value.toArray();
    }
    if (typeof value.length === 'number') {
        var out = [];
        for (var i = 0; i < value.length; i++) {
            out.push(value[i]);
        }
        return out;
    }
    return [];
}

function getDestinationKey(estimate) {
    var destination = estimate.destination || {};
    return String(destination.countryCode || '').trim() + '|' + String(destination.postalCode || '').trim();
}

function getQuantity() {
    // ProductDeliveryEstimateWO does not expose quantity. PDP estimates are one unit per requested product.
    return 1;
}

function buildShippingMethodsById() {
    var ShippingMgr = require('dw/order/ShippingMgr');
    var allMethods = ShippingMgr.getAllShippingMethods && ShippingMgr.getAllShippingMethods();
    var methods = toArray(allMethods);
    var byId = {};

    for (var i = 0; i < methods.length; i++) {
        var method = methods[i];
        if (!method) {
            continue;
        }
        var id = String(method.ID || '');
        if (id) {
            byId[id] = method;
        }
    }

    return byId;
}

function getCustomValue(object, attributeId) {
    if (!object || !object.custom) {
        return '';
    }
    return String(object.custom[attributeId] || '').trim();
}

function resolveMethod(option, shippingMethodsById) {
    var methodId = String(option && option.shippingMethodId || '').trim();
    if (!methodId) {
        return null;
    }

    var shippingMethod = shippingMethodsById[methodId] || null;
    var cdsMethodName = getCustomValue(shippingMethod, 'cdsMethodName');
    var cdsCarrier = getCustomValue(shippingMethod, 'cdsShippingCarrier');
    if (!cdsCarrier || !cdsMethodName) {
        return null;
    }

    return {
        carrier: cdsCarrier,
        methodName: cdsMethodName
    };
}

function addUniqueMethod(methodsByCarrier, option, shippingMethodsById) {
    var method = resolveMethod(option, shippingMethodsById);
    if (method && method.carrier && method.methodName) {
        if (!methodsByCarrier[method.carrier]) {
            methodsByCarrier[method.carrier] = {};
        }
        methodsByCarrier[method.carrier][method.methodName] = method;
    }
}

function buildCarrier(carrier, methodsByName) {
    var methodNames = Object.keys(methodsByName);

    return {
        name: carrier,
        methods: methodNames.map(function (methodName) {
            return { name: methodName };
        })
    };
}

function buildCarriers(methodsByCarrier) {
    return Object.keys(methodsByCarrier).map(function (carrier) {
        return buildCarrier(carrier, methodsByCarrier[carrier]);
    });
}

function buildRequests(estimates) {
    var products = [];
    var methodsByCarrier = {};
    var destination;
    var normalized = toArray(estimates);
    var shippingMethodsById = buildShippingMethodsById();

    for (var i = 0; i < normalized.length; i++) {
        var estimate = normalized[i];
        if (!estimate || !estimate.productId || !estimate.destination) {
            continue;
        }

        destination = destination || estimate.destination;
        products.push({
            stockKeepingUnit: String(estimate.productId).trim(),
            quantity: getQuantity()
        });

        var options = toArray(estimate.shippingOptions);
        for (var j = 0; j < options.length; j++) {
            addUniqueMethod(methodsByCarrier, options[j], shippingMethodsById);
        }
    }

    if (!destination || products.length === 0 || Object.keys(methodsByCarrier).length === 0) {
        return null;
    }

    var countryCode = String(destination.countryCode || '').trim();
    var postalCode = String(destination.postalCode || '').trim();
    if (!countryCode || !postalCode) {
        return null;
    }

    return {
        deliveryEstimationSetupName: cdsConfig.getDeliveryEstimationSetupName(),
        shippingCarriers: buildCarriers(methodsByCarrier),
        products: products,
        deliveryAddress: {
            country: countryCode,
            postalCode: postalCode
        }
    };
}

function buildRequest(estimates) {
    return buildRequests(estimates);
}

function groupEstimatesByDestination(estimates) {
    var groupsByKey = {};
    var groups = [];
    var normalized = toArray(estimates);

    for (var i = 0; i < normalized.length; i++) {
        var estimate = normalized[i];
        if (!estimate || !estimate.destination) {
            continue;
        }

        var key = getDestinationKey(estimate);
        if (!groupsByKey[key]) {
            groupsByKey[key] = [];
            groups.push(groupsByKey[key]);
        }
        groupsByKey[key].push(estimate);
    }

    return groups;
}

module.exports = {
    toArray: toArray,
    buildRequest: buildRequest,
    buildRequests: buildRequests,
    buildCarriers: buildCarriers,
    buildShippingMethodsById: buildShippingMethodsById,
    resolveMethod: resolveMethod,
    groupEstimatesByDestination: groupEstimatesByDestination
};
