'use strict';

var CacheMgr = require('dw/system/CacheMgr');
var Logger = require('dw/system/Logger');
var Site = require('dw/system/Site');
var requestBuilder = require('~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder');

var CACHE_ID = 'CDSShippingPDPDeliveryEstimate';
var logger = Logger.getLogger('cds-shipping', 'pdp-estimate-cache');

function getCache() {
    try {
        return CacheMgr.getCache(CACHE_ID);
    } catch (e) {
        logger.warn('CDS PDP estimate cache unavailable: {0}', e.message || String(e));
        return null;
    }
}

function normalizePart(value) {
    return encodeURIComponent(String(value || '').trim());
}

function buildKey(estimates) {
    var normalized = requestBuilder.toArray(estimates);
    var destination = normalized.length > 0 ? normalized[0].destination || {} : {};
    var productsById = {};

    for (var i = 0; i < normalized.length; i++) {
        if (normalized[i] && normalized[i].productId) {
            productsById[String(normalized[i].productId).trim()] = true;
        }
    }

    return [
        normalizePart(Site.getCurrent().ID),
        normalizePart(destination.countryCode),
        normalizePart(destination.postalCode),
        normalizePart(Object.keys(productsById).sort().join(','))
    ].join('|');
}

function get(key) {
    var cache = getCache();
    if (!cache) {
        return null;
    }

    var value = cache.get(key);
    if (!value) {
        return null;
    }

    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (e) {
        logger.warn('Failed to parse cached CDS PDP estimate for key {0}: {1}', key, e.message || String(e));
        return null;
    }
}

function put(key, value) {
    var cache = getCache();
    if (!cache || !value) {
        return;
    }

    try {
        cache.put(key, JSON.stringify(value));
    } catch (e) {
        logger.warn('Failed to cache CDS PDP estimate for key {0}: {1}', key, e.message || String(e));
    }
}

module.exports = {
    CACHE_ID: CACHE_ID,
    buildKey: buildKey,
    get: get,
    put: put
};
