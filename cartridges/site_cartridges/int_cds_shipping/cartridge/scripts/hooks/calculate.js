'use strict';

var Logger = require('dw/system/Logger');
var ShippingMgr = require('dw/order/ShippingMgr');
var Status = require('dw/system/Status');
var requestBuilder = require('~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder');
var shipmentEstimateHelper = require('~/cartridge/scripts/helpers/shipmentDeliveryEstimateHelper');
var cdsShippingService = require('~/cartridge/scripts/services/cdsShippingService');

var logger = Logger.getLogger('cds-shipping', 'calculate');

/**
 * sfcc.app.shipping.calculate
 *
 * Fires during dw.order.calculate on every basket/order recalculation.
 * Calls ShippingMgr.applyShippingCost first for native prices, then stores CDS
 * delivery metadata on shipments with address + selected CDS-mapped method.
 *
 * @param {dw.order.LineItemCtnr} lineItemCtnr - Basket or Order being calculated.
 * @returns {dw.system.Status} Status.OK on success; Status.ERROR blocks calculation.
 */
exports.calculate = function (lineItemCtnr) {
    try {
        ShippingMgr.applyShippingCost(lineItemCtnr);

        var shipments = requestBuilder.toArray(lineItemCtnr && lineItemCtnr.shipments);
        var shippingMethodsById = requestBuilder.buildShippingMethodsById();
        var populated = 0;
        for (var i = 0; i < shipments.length; i++) {
            populated += applyCdsDeliveryMetadata(shipments[i], shippingMethodsById);
        }

        logger.debug('CDS calculate hook stored delivery metadata for {0} shipment(s).', populated);
        return new Status(Status.OK);
    } catch (e) {
        logger.error('CDS calculate hook failed: {0}\n{1}', e.message, e.stack);
        return new Status(Status.ERROR, 'CDS_CALCULATE_FAILED', 'CDS Shipping calculate hook threw: ' + e.message);
    }
};

function applyCdsDeliveryMetadata(shipment, shippingMethodsById) {
    var estimateKey = shipmentEstimateHelper.buildEstimateKey(shipment);
    if (!estimateKey || !shipment || !shipment.custom) {
        return 0;
    }

    var snapshot = shipmentEstimateHelper.readSnapshot(shipment);
    var storedKey = String(shipment.custom.deliveryEstimateKey || '');
    var canRefresh = isRefreshCapableRequest();
    var applied = 0;

    if (!canRefresh) {
        return 0;
    }

    if (snapshot && storedKey === estimateKey) {
        applied = shipmentEstimateHelper.applySnapshotToShipment(shipment, snapshot);
    }

    if (!snapshot || storedKey !== estimateKey || applied === 0) {
        snapshot = refreshSnapshot(shipment, estimateKey, shippingMethodsById);
        applied = shipmentEstimateHelper.applySnapshotToShipment(shipment, snapshot);
    }

    return applied;
}

function refreshSnapshot(shipment, estimateKey, shippingMethodsById) {
    var request = shipmentEstimateHelper.buildSnapshotRequest(shipment, shippingMethodsById);
    var snapshot = {
        generatedAt: new Date().toISOString(),
        methods: {}
    };

    if (!request) {
        shipmentEstimateHelper.writeSnapshot(shipment, estimateKey, snapshot);
        return snapshot;
    }

    var serviceResult = cdsShippingService.callDeliveryEstimation(request.requestBody);
    if (!serviceResult || !serviceResult.ok || !serviceResult.object) {
        logger.warn('CDS calculate estimate unavailable for shipment.');
    } else {
        snapshot = shipmentEstimateHelper.addResponseToSnapshot(snapshot, serviceResult.object, request.methodIdByCdsName);
    }

    shipmentEstimateHelper.writeSnapshot(shipment, estimateKey, snapshot);
    return snapshot;
}

function isRefreshCapableRequest() {
    if (typeof request === 'undefined' || !request) {
        return false;
    }

    var method = String(request.httpMethod || '').toUpperCase();
    var path = String(request.httpPath || '');

    if (method === 'PATCH' && /\/baskets\/[^/]+\/?$/.test(path)) {
        return true;
    }

    return method === 'PUT' &&
        /\/baskets\/[^/]+\/shipments\/[^/]+\/shipping-(address|method)\/?$/.test(path);
}

exports._private = {
    buildCalculateRequest: shipmentEstimateHelper.buildCalculateRequest,
    buildEstimateKey: shipmentEstimateHelper.buildEstimateKey,
    applyCdsDeliveryMetadata: applyCdsDeliveryMetadata,
    isRefreshCapableRequest: isRefreshCapableRequest,
    refreshSnapshot: refreshSnapshot,
    getWindowForMethod: shipmentEstimateHelper.getWindowForMethod,
    getAddress: shipmentEstimateHelper.getAddress,
    getProducts: shipmentEstimateHelper.getProducts
};
