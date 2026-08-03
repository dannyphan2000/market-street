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

        logger.warn('CDS calculate hook stored delivery metadata for {0} shipment(s).', populated);
        return new Status(Status.OK);
    } catch (e) {
        logger.error('CDS calculate hook failed: {0}\n{1}', e.message, e.stack);
        return new Status(Status.ERROR, 'CDS_CALCULATE_FAILED', 'CDS Shipping calculate hook threw: ' + e.message);
    }
};

function applyCdsDeliveryMetadata(shipment, shippingMethodsById) {
    var request = shipmentEstimateHelper.buildCalculateRequest(shipment, shippingMethodsById);
    if (!request) {
        return 0;
    }

    var serviceResult = cdsShippingService.callDeliveryEstimation(request.requestBody);
    if (!serviceResult || !serviceResult.ok || !serviceResult.object) {
        logger.warn('CDS calculate estimate unavailable for shipment.');
        return 0;
    }

    var window = shipmentEstimateHelper.getWindowForMethod(serviceResult.object, request.resolvedMethodName);
    if (!window || !shipment.custom) {
        return 0;
    }

    shipment.custom.deliveryWindowStartAt = window.startAt;
    shipment.custom.deliveryWindowEndAt = window.endAt;
    if (window.orderCutoffAt) {
        shipment.custom.orderCutoffAt = window.orderCutoffAt;
    }

    return 1;
}

exports._private = {
    buildCalculateRequest: shipmentEstimateHelper.buildCalculateRequest,
    applyCdsDeliveryMetadata: applyCdsDeliveryMetadata,
    getWindowForMethod: shipmentEstimateHelper.getWindowForMethod,
    getAddress: shipmentEstimateHelper.getAddress,
    getProducts: shipmentEstimateHelper.getProducts
};
