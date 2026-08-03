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
        var estimateKey = shipmentEstimateHelper.buildEstimateKey(shipment);
        var snapshot = shipmentEstimateHelper.readSnapshot(shipment);
        var storedKey = shipment && shipment.custom ? String(shipment.custom.deliveryEstimateKey || '') : '';

        // Reuse a fresh snapshot (written by the calculate hook for the same address + products)
        // when present; otherwise fetch one now. Both paths batch every CDS-mapped carrier into a
        // single request and share the per-plan / best-alternative aggregation the calculate hook uses.
        if (!snapshot || storedKey !== estimateKey) {
            snapshot = fetchSnapshot(shipment);
        }

        var populated = shipmentEstimateHelper.applySnapshotToQuote(snapshot, methods);
        logger.debug('CDS quote hook populated {0} shipping method(s) for shipment {1}.', populated, shipmentNo);
        return new Status(Status.OK);
    } catch (e) {
        logger.error('CDS quote hook failed: {0}\n{1}', e.message, e.stack);
        return new Status(Status.ERROR, 'CDS_QUOTE_FAILED', 'CDS Shipping quote hook threw: ' + e.message);
    }
};

/**
 * Fetch a delivery-estimate snapshot for the shipment by batching every CDS-mapped shipping
 * method into a single delivery-estimation call, mirroring the calculate hook's refresh. Unlike
 * calculate, the result is not persisted to the shipment (quote fires on a read-only GET).
 *
 * @param {dw.order.Shipment} shipment - The shipment being priced.
 * @returns {Object} Snapshot with a `methods` map keyed by shipping method id.
 */
function fetchSnapshot(shipment) {
    var shippingMethodsById = requestBuilder.buildShippingMethodsById();
    var request = shipmentEstimateHelper.buildSnapshotRequest(shipment, shippingMethodsById);
    var snapshot = { methods: {} };

    if (!request) {
        return snapshot;
    }

    var serviceResult = cdsShippingService.callDeliveryEstimation(request.requestBody);
    if (!serviceResult || !serviceResult.ok || !serviceResult.object) {
        logger.warn('CDS quote estimate unavailable for shipment.');
        return snapshot;
    }

    return shipmentEstimateHelper.addResponseToSnapshot(snapshot, serviceResult.object, request.methodIdByCdsName);
}

exports._private = {
    fetchSnapshot: fetchSnapshot,
    buildSnapshotRequest: shipmentEstimateHelper.buildSnapshotRequest,
    buildEstimateKey: shipmentEstimateHelper.buildEstimateKey,
    applySnapshotToQuote: shipmentEstimateHelper.applySnapshotToQuote,
    getAddress: shipmentEstimateHelper.getAddress,
    getProducts: shipmentEstimateHelper.getProducts
};
