'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Logger = require('dw/system/Logger');
var cdsConfig = require('~/cartridge/scripts/config/cdsShippingConfig');

var logger = Logger.getLogger('cds-shipping', 'account-manager-token');
var SERVICE_ID = 'cds.accountmanager.oauth';

function getTokenEndpointUrl(baseUrl, deliveryConfig) {
    return baseUrl.replace(/\/$/, '') +
        '/dw/oauth2/access_token?grant_type=client_credentials&scope=' +
        deliveryConfig.scope +
        '%3A' +
        encodeURIComponent(deliveryConfig.realmInstanceId) +
        '%20' +
        encodeURIComponent(deliveryConfig.commercedeliverybindingid) +
        '%20' +
        encodeURIComponent(deliveryConfig.commerceinventorybindingid);
}

function hasRequiredConfig(deliveryConfig) {
    return !!(deliveryConfig.accountManagerUrl &&
        deliveryConfig.scope &&
        deliveryConfig.realmInstanceId &&
        deliveryConfig.commercedeliverybindingid &&
        deliveryConfig.commerceinventorybindingid);
}

function getCredentialValue(credential, getterName, propertyName) {
    if (!credential) {
        return '';
    }
    if (typeof credential[getterName] === 'function') {
        return String(credential[getterName]() || '');
    }
    return String(credential[propertyName] || '');
}

function getServiceCredential(svc) {
    var config = svc && svc.getConfiguration ? svc.getConfiguration() : null;
    if (config && config.getCredential) {
        return config.getCredential();
    }
    return null;
}

function createService(deliveryConfig) {
    return LocalServiceRegistry.createService(SERVICE_ID, {
        createRequest: function (svc) {
            var baseUrl = typeof svc.getURL === 'function' ? svc.getURL() : (svc.URL != null ? String(svc.URL) : '');
            var credential = getServiceCredential(svc);
            var clientId = getCredentialValue(credential, 'getUser', 'user');
            var clientSecret = getCredentialValue(credential, 'getPassword', 'password');

            svc.setURL(getTokenEndpointUrl(baseUrl || deliveryConfig.accountManagerUrl, deliveryConfig));
            svc.setRequestMethod('POST');
            svc.getClient().setTimeout(10000);
            if (typeof svc.setAuthentication === 'function') {
                svc.setAuthentication('BASIC');
            }
            svc.addHeader('Content-Type', 'application/x-www-form-urlencoded');
            svc.addHeader('Accept', '*/*');

            if (!clientId || !clientSecret) {
                logger.warn('Missing Account Manager service credential user or password.');
            }

            return '';
        },
        parseResponse: function (_svc, client) {
            if (!client || !client.text) {
                logger.warn('Empty Account Manager token response.');
                return null;
            }

            try {
                return JSON.parse(client.text);
            } catch (e) {
                logger.error('Failed to parse Account Manager token response: {0}', e.message || String(e));
                return null;
            }
        },
        filterLogMessage: function (msg) {
            return msg;
        }
    });
}

function getAccountManagerToken() {
    var deliveryConfig = cdsConfig.getCommerceDeliveryConfig();
    if (!hasRequiredConfig(deliveryConfig)) {
        logger.warn('Missing CDS Account Manager configuration.');
        return null;
    }

    try {
        var result = createService(deliveryConfig).call();
        if (result && result.ok && result.object && result.object.access_token) {
            return result.object.access_token;
        }

        logger.warn('Failed to get CDS Account Manager token. ok={0}, status={1}, error={2}, msg={3}',
            result ? result.ok : 'null',
            result ? result.status : 'null',
            result ? result.error : 'null',
            result ? result.msg : 'null');
        return null;
    } catch (e) {
        logger.error('CDS Account Manager token error: {0}', e.message || String(e));
        return null;
    }
}

module.exports = {
    SERVICE_ID: SERVICE_ID,
    createService: createService,
    getAccountManagerToken: getAccountManagerToken,
    getTokenEndpointUrl: getTokenEndpointUrl
};
