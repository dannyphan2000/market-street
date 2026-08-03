'use strict';

/**
 * LocalServiceRegistry client for the CDS Shipping API.
 */

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Logger = require('dw/system/Logger');
var UUIDUtils = require('dw/util/UUIDUtils');
var cdsConfig = require('~/cartridge/scripts/config/cdsShippingConfig');
var tokenService = require('~/cartridge/scripts/services/accountManagerTokenService');

var SERVICE_ID = 'cds.shipping.api';
var DELIVERY_DATE_ENDPOINT = '/commerce/delivery/v2/estimate/delivery-date';
var logger = Logger.getLogger('cds-shipping', 'service');

function createService(realmInstanceId) {
    return LocalServiceRegistry.createService(SERVICE_ID, {
        createRequest: function (svc, requestBody) {
            var baseUrl = typeof svc.getURL === 'function' ? svc.getURL() : (svc.URL != null ? String(svc.URL) : '');
            var finalUrl = baseUrl.replace(/\/+$/, '') + DELIVERY_DATE_ENDPOINT;

            svc.setURL(finalUrl);
            svc.setRequestMethod('POST');
            svc.addHeader('Content-Type', 'application/json');
            svc.addHeader('Accept', '*/*');
            svc.addHeader('Accept-Encoding', 'gzip, deflate, br');
            svc.addHeader('Connection', 'keep-alive');
            svc.addHeader('Correlation-ID', UUIDUtils.createUUID());
            svc.addHeader('x-salesforce-region', cdsConfig.getSalesforceRegion());
            svc.addHeader('SALESFORCE_COMMERCE_API', realmInstanceId);

            var token = tokenService.getAccountManagerToken();
            if (token) {
                svc.addHeader('Authorization', 'Bearer ' + token);
            } else {
                logger.warn('No Account Manager token available for CDS delivery estimate request.');
            }

            var serializedBody = requestBody ? JSON.stringify(requestBody) : '';
            logger.debug('CDS delivery estimate request body: {0}', serializedBody || '{}');
            return serializedBody;
        },
        parseResponse: function (svc, response) {
            if (!response || !response.text) {
                logger.warn('CDS delivery estimate response was empty.');
                return null;
            }

            try {
                logger.debug('CDS delivery estimate raw response: {0}', response.text);
                return JSON.parse(response.text);
            } catch (e) {
                logger.error('Failed to parse CDS delivery estimate response: {0}', e.message || String(e));
                return null;
            }
        },
        filterLogMessage: function (msg) {
            // Redact the bearer token from the service communication log.
            return String(msg || '').replace(/(Authorization\s*:\s*Bearer\s+)\S+/gi, '$1***');
        }
    });
}

function callDeliveryEstimation(requestBody) {
    var realmInstanceId = cdsConfig.getRealmInstanceId();
    var service = createService(realmInstanceId);
    return service.call(requestBody);
}

module.exports = {
    SERVICE_ID: SERVICE_ID,
    DELIVERY_DATE_ENDPOINT: DELIVERY_DATE_ENDPOINT,
    createService: createService,
    callDeliveryEstimation: callDeliveryEstimation
};
