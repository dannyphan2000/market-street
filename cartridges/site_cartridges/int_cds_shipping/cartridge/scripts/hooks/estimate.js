'use strict';

var Logger = require('dw/system/Logger');
var Status = require('dw/system/Status');
var requestBuilder = require('~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder');
var responseMapper = require('~/cartridge/scripts/helpers/deliveryEstimateResponseMapper');
var pdpEstimateCache = require('~/cartridge/scripts/helpers/pdpEstimateCache');
var cdsShippingService = require('~/cartridge/scripts/services/cdsShippingService');

var logger = Logger.getLogger('cds-shipping', 'estimate');

/**
 * sfcc.app.shipping.estimate
 *
 * Populates PDP delivery estimates on the supplied DeliveryEstimatesResultWO skeleton.
 * The platform drops any ShippingOption left unpopulated. An option is considered
 * "populated" if at least one of price / deliveryWindow / nonDeliverableReason is set.
 *
 * @param {Object} result - DeliveryEstimatesResultWO; mutated in place.
 * @returns {dw.system.Status} Status.OK on success; Status.ERROR fails the request.
 */
exports.estimate = function (result) {
    try {
        if (!result || !result.productDeliveryEstimates) {
            logger.warn('CDS estimate hook invoked with empty result skeleton.');
            return new Status(Status.OK);
        }

        var groups = requestBuilder.groupEstimatesByDestination(result.productDeliveryEstimates);
        var populated = 0;

        for (var i = 0; i < groups.length; i++) {
            var requestBody = requestBuilder.buildRequest(groups[i]);
            if (!requestBody) {
                logger.warn('CDS estimate hook skipped group {0}; no product, destination, or CDS-mapped shipping methods.', i);
                continue;
            }

            var cacheKey = pdpEstimateCache.buildKey(groups[i]);
            var response = pdpEstimateCache.get(cacheKey);
            if (!response) {
                var serviceResult = cdsShippingService.callDeliveryEstimation(requestBody);
                if (!serviceResult || !serviceResult.ok || !serviceResult.object) {
                    logger.warn('CDS delivery estimate unavailable for group {0}. Leaving options unpopulated.', i);
                    continue;
                }
                response = serviceResult.object;
                pdpEstimateCache.put(cacheKey, response);
            }

            logger.warn('CDS delivery estimate response for group {0}: {1}', i, JSON.stringify(response));
            var groupPopulated = responseMapper.mapToResult(response, groups[i]);
            logger.warn('CDS estimate hook populated {0} shipping option(s) for group {1}.', groupPopulated, i);
            populated += groupPopulated;
        }

        logger.warn('CDS estimate hook populated {0} shipping option(s).', populated);
        return new Status(Status.OK);
    } catch (e) {
        logger.error('CDS estimate hook failed: {0}\n{1}', e.message, e.stack);
        return new Status(Status.ERROR, 'CDS_ESTIMATE_FAILED', 'CDS Shipping estimate hook threw: ' + e.message);
    }
};
