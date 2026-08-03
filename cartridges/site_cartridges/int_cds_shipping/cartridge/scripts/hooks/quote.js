'use strict';

var Logger = require('dw/system/Logger');
var Status = require('dw/system/Status');
var requestBuilder = require('~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder');
var shipmentEstimateHelper = require('~/cartridge/scripts/helpers/shipmentDeliveryEstimateHelper');
var cdsShippingService = require('~/cartridge/scripts/services/cdsShippingService');

var logger = Logger.getLogger('cds-shipping', 'quote');

/**
 * sfcc.app.shipping.quote
 *
 * Fires on GET /baskets/{basket_id}/shipments/{shipment_id}/shipping-methods.
 * Populates delivery estimates for applicable shipping methods that are mapped to CDS.
 * Methods without cdsShippingCarrier/cdsMethodName are left untouched.
 *
 * @param {dw.order.Shipment} shipment - The shipment being priced.
 * @param {Object} result - ShippingMethodResultWO with applicableShippingMethods preloaded.
 * @returns {dw.system.Status} Status.OK on success; Status.ERROR aborts the request.
 */
exports.quote = function (shipment, result) {
    try {
        if (!result || !result.applicableShippingMethods) {
            logger.warn('CDS quote hook invoked with empty shipping method result.');
            return new Status(Status.OK);
        }

        var methods = requestBuilder.toArray(result.applicableShippingMethods);
        var shipmentNo = shipment ? shipment.getShipmentNo() : 'unknown';
        var requestGroups = shipmentEstimateHelper.buildQuoteRequests(shipment, methods);
        var populated = 0;

        for (var i = 0; i < requestGroups.length; i++) {
            var group = requestGroups[i];
            var serviceResult = cdsShippingService.callDeliveryEstimation(group.requestBody);
            if (!serviceResult || !serviceResult.ok || !serviceResult.object) {
                logger.warn('CDS quote estimate unavailable for shipment {0}, carrier {1}.', shipmentNo, group.carrier);
                continue;
            }
            populated += shipmentEstimateHelper.applyQuoteResponse(serviceResult.object, group.methodByCdsName);
        }

        logger.warn('CDS quote hook populated {0} shipping method(s) for shipment {1}.', populated, shipmentNo);
        return new Status(Status.OK);
    } catch (e) {
        logger.error('CDS quote hook failed: {0}\n{1}', e.message, e.stack);
        return new Status(Status.ERROR, 'CDS_QUOTE_FAILED', 'CDS Shipping quote hook threw: ' + e.message);
    }
};

exports._private = {
    buildQuoteRequests: shipmentEstimateHelper.buildQuoteRequests,
    applyQuoteResponse: shipmentEstimateHelper.applyQuoteResponse,
    getAddress: shipmentEstimateHelper.getAddress,
    getProducts: shipmentEstimateHelper.getProducts
};
