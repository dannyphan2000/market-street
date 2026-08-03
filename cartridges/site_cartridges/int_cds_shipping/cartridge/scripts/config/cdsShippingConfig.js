'use strict';

var Site = require('dw/system/Site');

var DEFAULT_CDS_SCOPE = 'SALESFORCE_COMMERCE_API';
var DEFAULT_COMMERCE_DELIVERY_BINDING_ID = 'sfcc.commercedeliveryservice.shopper';
var DEFAULT_COMMERCE_INVENTORY_BINDING_ID = 'sfcc.inventory.availability';
var DEFAULT_ACCOUNT_MANAGER_URL = 'https://account-pod5.demandware.net/';
var DEFAULT_SALESFORCE_REGION = 'us-west-2';

function getPreference(id) {
    var value = Site.current.getCustomPreferenceValue(id);
    return String(value != null ? value : '');
}

function isEmpty(value) {
    var text = String(value || '').trim();
    return text === '' || text.toLowerCase() === 'null';
}

function prefOrDefault(prefId, defaultValue) {
    var value = getPreference(prefId);
    if (!isEmpty(value)) {
        return value.trim();
    }
    return String(defaultValue || '').trim();
}

function getCommerceDeliveryConfig() {
    return {
        realmInstanceId: prefOrDefault('realmInstanceId', ''),
        accountManagerUrl: DEFAULT_ACCOUNT_MANAGER_URL,
        scope: DEFAULT_CDS_SCOPE,
        commercedeliverybindingid: DEFAULT_COMMERCE_DELIVERY_BINDING_ID,
        commerceinventorybindingid: DEFAULT_COMMERCE_INVENTORY_BINDING_ID
    };
}

function getRealmInstanceId() {
    return prefOrDefault('realmInstanceId', '');
}

function getSalesforceRegion() {
    return prefOrDefault('salesforceRegion', DEFAULT_SALESFORCE_REGION);
}

function getDeliveryEstimationSetupName() {
    return prefOrDefault('deliveryEstimationSetupName', Site.getCurrent().ID);
}

module.exports = {
    DEFAULT_CDS_SCOPE: DEFAULT_CDS_SCOPE,
    DEFAULT_COMMERCE_DELIVERY_BINDING_ID: DEFAULT_COMMERCE_DELIVERY_BINDING_ID,
    DEFAULT_COMMERCE_INVENTORY_BINDING_ID: DEFAULT_COMMERCE_INVENTORY_BINDING_ID,
    DEFAULT_ACCOUNT_MANAGER_URL: DEFAULT_ACCOUNT_MANAGER_URL,
    getCommerceDeliveryConfig: getCommerceDeliveryConfig,
    getRealmInstanceId: getRealmInstanceId,
    getSalesforceRegion: getSalesforceRegion,
    getDeliveryEstimationSetupName: getDeliveryEstimationSetupName
};
