'use strict';

var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru();

function toArray(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    return [];
}

describe('CDS delivery estimate integration', function () {
    describe('config defaults', function () {
        function loadConfig(preferences, siteId) {
            return proxyquire('../../cartridge/scripts/config/cdsShippingConfig', {
                'dw/system/Site': {
                    current: {
                        getCustomPreferenceValue: function (id) {
                            return preferences[id] || '';
                        }
                    },
                    getCurrent: function () {
                        return { ID: siteId || 'RefArch' };
                    }
                }
            });
        }

        it('uses BM site preference values with app-provided token config', function () {
            var config = loadConfig({
                realmInstanceId: 'realm-from-bm',
                salesforceRegion: 'us-west-2',
                deliveryEstimationSetupName: 'setup-from-bm'
            });

            expect(config.getCommerceDeliveryConfig().realmInstanceId).to.equal('realm-from-bm');
            expect(config.getCommerceDeliveryConfig().accountManagerUrl).to.equal('https://account-pod5.demandware.net/');
            expect(config.getCommerceDeliveryConfig().scope).to.equal('SALESFORCE_COMMERCE_API');
            expect(config.getCommerceDeliveryConfig().commercedeliverybindingid).to.equal('sfcc.commercedeliveryservice.shopper');
            expect(config.getCommerceDeliveryConfig().commerceinventorybindingid).to.equal('sfcc.inventory.availability');
            expect(config.getSalesforceRegion()).to.equal('us-west-2');
            expect(config.getDeliveryEstimationSetupName()).to.equal('setup-from-bm');
        });

        it('uses only safe app defaults when BM site preference values are empty', function () {
            var config = loadConfig({});

            var prefs = config.getCommerceDeliveryConfig();

            expect(prefs.realmInstanceId).to.equal('');
            expect(prefs.accountManagerUrl).to.equal('https://account-pod5.demandware.net/');
            expect(config.getSalesforceRegion()).to.equal('us-west-2');
            expect(config.getDeliveryEstimationSetupName()).to.equal('RefArch');
        });
    });

    describe('request builder', function () {
        var requestBuilder = proxyquire('../../cartridge/scripts/helpers/deliveryEstimateRequestBuilder', {
            '~/cartridge/scripts/config/cdsShippingConfig': {
                getDeliveryEstimationSetupName: function () {
                    return 'RefArch';
                }
            },
            'dw/order/ShippingMgr': {
                getAllShippingMethods: function () {
                    return [
                        {
                            ID: 'GroundShipping',
                            custom: {
                                cdsShippingCarrier: 'UPSManage',
                                cdsMethodName: 'NON_PICKUP_DAYS_UPS'
                            }
                        },
                        {
                            ID: 'TwoDayShipping',
                            custom: {
                                cdsShippingCarrier: 'UPSManage',
                                cdsMethodName: 'NON_PICKUP_DAYS_2DAY'
                            }
                        },
                        {
                            ID: 'OvernightShipping',
                            custom: {
                                cdsShippingCarrier: 'FedEx',
                                cdsMethodName: 'PRIORITY_OVERNIGHT'
                            }
                        }
                    ];
                }
            }
        });

        it('builds a CDS delivery-date request from the SCAPI skeleton', function () {
            var request = requestBuilder.buildRequest([
                {
                    productId: 'sku-1',
                    destination: { countryCode: 'US', postalCode: '10001' },
                    shippingOptions: [
                        { shippingMethodId: 'GroundShipping' },
                        { shippingMethodId: 'TwoDayShipping' }
                    ]
                }
            ]);

            expect(request).to.deep.equal({
                deliveryEstimationSetupName: 'RefArch',
                shippingCarriers: [
                    {
                        name: 'UPSManage',
                        methods: [
                            { name: 'NON_PICKUP_DAYS_UPS' },
                            { name: 'NON_PICKUP_DAYS_2DAY' }
                        ]
                    }
                ],
                products: [
                    { stockKeepingUnit: 'sku-1', quantity: 1 }
                ],
                deliveryAddress: {
                    country: 'US',
                    postalCode: '10001'
                }
            });
        });

        it('builds one CDS estimate request with multiple carriers', function () {
            var request = requestBuilder.buildRequests([
                {
                    productId: 'sku-1',
                    destination: { countryCode: 'US', postalCode: '10001' },
                    shippingOptions: [
                        { shippingMethodId: 'GroundShipping' },
                        { shippingMethodId: 'OvernightShipping' }
                    ]
                }
            ]);

            expect(request.shippingCarriers).to.deep.equal([
                {
                    name: 'UPSManage',
                    methods: [
                        { name: 'NON_PICKUP_DAYS_UPS' }
                    ]
                },
                {
                    name: 'FedEx',
                    methods: [
                        { name: 'PRIORITY_OVERNIGHT' }
                    ]
                }
            ]);
        });

        it('filters out methods without CDS custom mapping', function () {
            var fallbackBuilder = proxyquire('../../cartridge/scripts/helpers/deliveryEstimateRequestBuilder', {
                '~/cartridge/scripts/config/cdsShippingConfig': {
                    getDeliveryEstimationSetupName: function () {
                        return 'RefArch';
                    }
                },
                'dw/order/ShippingMgr': {
                    getAllShippingMethods: function () {
                        return [
                            {
                                ID: 'DefaultShipping',
                                custom: {}
                            }
                        ];
                    }
                }
            });

            var request = fallbackBuilder.buildRequest([
                {
                    productId: 'sku-2',
                    destination: { countryCode: 'US', postalCode: '94105' },
                    shippingOptions: [
                        { shippingMethodId: 'DefaultShipping' }
                    ]
                }
            ]);

            expect(request).to.equal(null);
        });

        it('keeps mapped methods and filters unmapped methods from the same skeleton', function () {
            var mixedBuilder = proxyquire('../../cartridge/scripts/helpers/deliveryEstimateRequestBuilder', {
                '~/cartridge/scripts/config/cdsShippingConfig': {
                    getDeliveryEstimationSetupName: function () {
                        return 'RefArch';
                    }
                },
                'dw/order/ShippingMgr': {
                    getAllShippingMethods: function () {
                        return [
                            {
                                ID: 'MappedShipping',
                                custom: {
                                    cdsShippingCarrier: 'UPSManage',
                                    cdsMethodName: 'NON_PICKUP_DAYS_UPS'
                                }
                            },
                            {
                                ID: 'UnmappedShipping',
                                custom: {}
                            }
                        ];
                    }
                }
            });

            var request = mixedBuilder.buildRequest([
                {
                    productId: 'sku-3',
                    destination: { countryCode: 'US', postalCode: '30301' },
                    shippingOptions: [
                        { shippingMethodId: 'MappedShipping' },
                        { shippingMethodId: 'UnmappedShipping' }
                    ]
                }
            ]);

            expect(request.shippingCarriers).to.deep.equal([
                {
                    name: 'UPSManage',
                    methods: [
                        { name: 'NON_PICKUP_DAYS_UPS' }
                    ]
                }
            ]);
        });

        it('groups estimates by destination before service calls', function () {
            var groups = requestBuilder.groupEstimatesByDestination([
                { productId: 'sku-1', destination: { countryCode: 'US', postalCode: '10001' } },
                { productId: 'sku-2', destination: { countryCode: 'US', postalCode: '10001' } },
                { productId: 'sku-3', destination: { countryCode: 'US', postalCode: '94105' } }
            ]);

            expect(groups).to.have.length(2);
            expect(groups[0]).to.have.length(2);
            expect(groups[1]).to.have.length(1);
        });
    });

    describe('response mapper', function () {
        var responseMapper = proxyquire('../../cartridge/scripts/helpers/deliveryEstimateResponseMapper', {
            '~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder': {
                toArray: toArray,
                buildShippingMethodsById: function () {
                    return {
                        GroundShipping: {
                            custom: {
                                cdsShippingCarrier: 'UPS',
                                cdsMethodName: 'NON_PICKUP_DAYS_UPS'
                            }
                        },
                        TwoDayShipping: {
                            custom: {
                                cdsShippingCarrier: 'UPS',
                                cdsMethodName: 'NON_PICKUP_DAYS_2DAY'
                            }
                        },
                        DefaultShippingMethod: {
                            custom: {
                                cdsShippingCarrier: 'UPSManage',
                                cdsMethodName: 'NON_PICKUP_DAYS_UPS'
                            }
                        }
                    };
                },
                resolveMethod: function (option, shippingMethodsById) {
                    var method = shippingMethodsById[option.shippingMethodId];
                    if (!method || !method.custom.cdsMethodName || !method.custom.cdsShippingCarrier) {
                        return null;
                    }
                    return {
                        carrier: method.custom.cdsShippingCarrier,
                        methodName: method.custom.cdsMethodName
                    };
                }
            }
        });

        it('maps CDS estimatedDeliveryDate to SCAPI deliveryWindow', function () {
            var scapiEstimates = [
                {
                    productId: 'sku-1',
                    shippingOptions: [
                        { shippingMethodId: 'GroundShipping' },
                        { shippingMethodId: 'TwoDayShipping' }
                    ]
                }
            ];
            var cdsResponse = {
                deliveryEstimates: [
                    {
                        deliveryEstimateGroup: [
                            {
                                productDeliveryEstimations: [
                                    { stockKeepingUnit: 'sku-1', quantity: 1 }
                                ],
                                shippingMethods: [
                                    {
                                        shippingCarrier: 'UPS',
                                        shippingCarrierMethod: 'NON_PICKUP_DAYS_UPS',
                                        orderCutoffTime: '2026-04-29T18:00:00Z',
                                        estimatedDeliveryDate: {
                                            min: '2026-04-30T14:00:00Z',
                                            max: '2026-04-30T18:00:00Z'
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            var populated = responseMapper.mapToResult(cdsResponse, scapiEstimates);

            expect(populated).to.equal(1);
            expect(scapiEstimates[0].shippingOptions[0].deliveryWindow).to.deep.equal({
                startAt: '2026-04-30T14:00:00Z',
                endAt: '2026-04-30T18:00:00Z'
            });
            expect(scapiEstimates[0].shippingOptions[0].carrier).to.equal('UPS');
            expect(scapiEstimates[0].shippingOptions[0].orderCutoffAt).to.equal('2026-04-29T18:00:00Z');
            expect(scapiEstimates[0].shippingOptions[1].deliveryWindow).to.equal(undefined);
        });

        it('does not fall back when product id does not match CDS response', function () {
            var scapiEstimates = [
                {
                    productId: 'storefront-product',
                    shippingOptions: [
                        { shippingMethodId: 'DefaultShippingMethod' }
                    ]
                }
            ];
            var cdsResponse = {
                estimatedDeliveryReference: '40cd7427-749a-11f1-b0c2-a7ef770cff63',
                deliveryEstimates: [
                    {
                        deliveryGroupId: 1,
                        deliveryEstimateGroup: [
                            {
                                location: 'NON_PICKUP_DAYS',
                                productDeliveryEstimations: [
                                    {
                                        stockKeepingUnit: '750518703299M',
                                        quantity: 1
                                    }
                                ],
                                shippingMethods: [
                                    {
                                        shippingCarrier: 'UPSManage',
                                        shippingCarrierMethod: 'NON_PICKUP_DAYS_UPS',
                                        routingCalculationType: 'STANDARD',
                                        estimatedShipDate: {
                                            type: 'Default',
                                            min: '2026-06-30T19:00:00',
                                            max: '2026-06-30T19:00:00'
                                        },
                                        estimatedDeliveryDate: {
                                            type: 'Calculated',
                                            min: '2026-07-01T10:30:00',
                                            max: '2026-07-01T10:30:00'
                                        },
                                        orderCutoffTime: '2026-06-30T16:00:00'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            var populated = responseMapper.mapToResult(cdsResponse, scapiEstimates);

            expect(populated).to.equal(0);
            expect(scapiEstimates[0].shippingOptions[0].deliveryWindow).to.equal(undefined);
        });

        it('falls back to estimatedShipDate when estimatedDeliveryDate is empty', function () {
            var scapiEstimates = [
                {
                    productId: '750518703299M',
                    shippingOptions: [
                        { shippingMethodId: 'DefaultShippingMethod' }
                    ]
                }
            ];
            var cdsResponse = {
                deliveryEstimates: [
                    {
                        deliveryEstimateGroup: [
                            {
                                productDeliveryEstimations: [
                                    { stockKeepingUnit: '750518703299M', quantity: 1 }
                                ],
                                shippingMethods: [
                                    {
                                        shippingCarrier: 'UPSManage',
                                        shippingCarrierMethod: 'NON_PICKUP_DAYS_UPS',
                                        estimatedShipDate: {
                                            type: 'Default',
                                            min: '2026-07-01T19:00:00',
                                            max: '2026-07-01T19:00:00'
                                        },
                                        estimatedDeliveryDate: {
                                            type: 'Calculated'
                                        },
                                        orderCutoffTime: '2026-07-01T16:00:00'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            var populated = responseMapper.mapToResult(cdsResponse, scapiEstimates);

            expect(populated).to.equal(1);
            expect(scapiEstimates[0].shippingOptions[0]).to.include({
                carrier: 'UPSManage',
                orderCutoffAt: '2026-07-01T16:00:00'
            });
            expect(scapiEstimates[0].shippingOptions[0].deliveryWindow).to.deep.equal({
                startAt: '2026-07-01T19:00:00',
                endAt: '2026-07-01T19:00:00'
            });
        });

        it('leaves options unpopulated when CDS does not return a valid window', function () {
            var scapiEstimates = [
                {
                    productId: 'sku-1',
                    shippingOptions: [{ shippingMethodId: 'GroundShipping' }]
                }
            ];

            var populated = responseMapper.mapToResult({
                deliveryEstimates: [
                    {
                        deliveryEstimateGroup: [
                            {
                                productDeliveryEstimations: [{ stockKeepingUnit: 'sku-1' }],
                                shippingMethods: [{ shippingCarrierMethod: 'GroundShipping' }]
                            }
                        ]
                    }
                ]
            }, scapiEstimates);

            expect(populated).to.equal(0);
            expect(scapiEstimates[0].shippingOptions[0].deliveryWindow).to.equal(undefined);
        });
    });

    describe('PDP estimate cache', function () {
        it('builds cache key from site, destination, and product ids', function () {
            var cache = proxyquire('../../cartridge/scripts/helpers/pdpEstimateCache', {
                'dw/system/CacheMgr': {
                    getCache: function () {
                        return {};
                    }
                },
                'dw/system/Logger': { getLogger: function () { return { warn: function () {} }; } },
                'dw/system/Site': {
                    getCurrent: function () {
                        return { ID: 'RefArch' };
                    }
                },
                '~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder': {
                    toArray: toArray
                }
            });

            expect(cache.buildKey([
                {
                    productId: 'sku-2',
                    destination: { countryCode: 'US', postalCode: '10001' }
                },
                {
                    productId: 'sku-1',
                    destination: { countryCode: 'US', postalCode: '10001' }
                }
            ])).to.equal('RefArch|US|10001|sku-1%2Csku-2');
        });
    });

    describe('estimate hook', function () {
        function Status(status, code, message) {
            this.status = status;
            this.code = code;
            this.message = message;
        }
        Status.OK = 'OK';
        Status.ERROR = 'ERROR';

        function logger() {
            return {
                warn: function () {},
                info: function () {},
                error: function () {}
            };
        }

        it('returns OK without mock fallback when CDS service fails', function () {
            var option = { shippingMethodId: 'GroundShipping' };
            var hook = proxyquire('../../cartridge/scripts/hooks/estimate', {
                'dw/system/Logger': { getLogger: logger },
                'dw/system/Status': Status,
                '~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder': {
                    groupEstimatesByDestination: function (estimates) {
                        return [estimates];
                    },
                    buildRequest: function () {
                        return { products: [{ stockKeepingUnit: 'sku-1', quantity: 1 }] };
                    }
                },
                '~/cartridge/scripts/helpers/pdpEstimateCache': {
                    buildKey: function () {
                        return 'cache-key';
                    },
                    get: function () {
                        return null;
                    },
                    put: function () {}
                },
                '~/cartridge/scripts/helpers/deliveryEstimateResponseMapper': {
                    mapToResult: function () {
                        throw new Error('mapper should not run');
                    }
                },
                '~/cartridge/scripts/services/cdsShippingService': {
                    callDeliveryEstimation: function () {
                        return { ok: false };
                    }
                }
            });

            var status = hook.estimate({
                productDeliveryEstimates: [
                    {
                        productId: 'sku-1',
                        destination: { countryCode: 'US', postalCode: '10001' },
                        shippingOptions: [option]
                    }
                ]
            });

            expect(status.status).to.equal(Status.OK);
            expect(option.deliveryWindow).to.equal(undefined);
            expect(option.price).to.equal(undefined);
        });

        it('uses cached PDP estimate response before calling CDS', function () {
            var option = { shippingMethodId: 'GroundShipping' };
            var serviceCalls = 0;
            var hook = proxyquire('../../cartridge/scripts/hooks/estimate', {
                'dw/system/Logger': { getLogger: logger },
                'dw/system/Status': Status,
                '~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder': {
                    groupEstimatesByDestination: function (estimates) {
                        return [estimates];
                    },
                    buildRequest: function () {
                        return { products: [{ stockKeepingUnit: 'sku-1', quantity: 1 }] };
                    }
                },
                '~/cartridge/scripts/helpers/pdpEstimateCache': {
                    buildKey: function () {
                        return 'cache-key';
                    },
                    get: function () {
                        return { deliveryEstimates: [] };
                    },
                    put: function () {
                        throw new Error('should not update cache on hit');
                    }
                },
                '~/cartridge/scripts/helpers/deliveryEstimateResponseMapper': {
                    mapToResult: function (response, estimates) {
                        estimates[0].shippingOptions[0].deliveryWindow = {
                            startAt: 'cached',
                            endAt: 'cached'
                        };
                        return 1;
                    }
                },
                '~/cartridge/scripts/services/cdsShippingService': {
                    callDeliveryEstimation: function () {
                        serviceCalls++;
                        return { ok: false };
                    }
                }
            });

            var status = hook.estimate({
                productDeliveryEstimates: [
                    {
                        productId: 'sku-1',
                        destination: { countryCode: 'US', postalCode: '10001' },
                        shippingOptions: [option]
                    }
                ]
            });

            expect(status.status).to.equal(Status.OK);
            expect(serviceCalls).to.equal(0);
            expect(option.deliveryWindow).to.deep.equal({
                startAt: 'cached',
                endAt: 'cached'
            });
        });
    });

    describe('quote hook', function () {
        function Status(status, code, message) {
            this.status = status;
            this.code = code;
            this.message = message;
        }
        Status.OK = 'OK';
        Status.ERROR = 'ERROR';

        function logger() {
            return {
                warn: function () {},
                info: function () {},
                error: function () {}
            };
        }

        function loadQuoteHook(serviceResult) {
            var requestBuilderMock = {
                toArray: function (value) {
                    if (!value) return [];
                    return Array.isArray(value) ? value : value.toArray();
                },
                buildShippingMethodsById: function () {
                    return {
                        MappedShipping: {
                            custom: {
                                cdsShippingCarrier: 'UPSManage',
                                cdsMethodName: 'NON_PICKUP_DAYS_UPS'
                            }
                        },
                        UnmappedShipping: {
                            custom: {}
                        }
                    };
                },
                resolveMethod: function (option, shippingMethodsById) {
                    var method = shippingMethodsById[option.shippingMethodId];
                    if (!method || !method.custom.cdsShippingCarrier || !method.custom.cdsMethodName) {
                        return null;
                    }
                    return {
                        carrier: method.custom.cdsShippingCarrier,
                        methodName: method.custom.cdsMethodName
                    };
                }
            };
            var shipmentHelper = proxyquire('../../cartridge/scripts/helpers/shipmentDeliveryEstimateHelper', {
                '~/cartridge/scripts/config/cdsShippingConfig': {
                    getDeliveryEstimationSetupName: function () {
                        return 'RefArch';
                    }
                },
                '~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder': requestBuilderMock
            });

            return proxyquire('../../cartridge/scripts/hooks/quote', {
                'dw/system/Logger': { getLogger: logger },
                'dw/system/Status': Status,
                '~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder': requestBuilderMock,
                '~/cartridge/scripts/helpers/shipmentDeliveryEstimateHelper': shipmentHelper,
                '~/cartridge/scripts/services/cdsShippingService': {
                    callDeliveryEstimation: function () {
                        return serviceResult;
                    }
                }
            });
        }

        function shipment() {
            return {
                getShipmentNo: function () {
                    return 'shipment-1';
                },
                getShippingAddress: function () {
                    return {
                        countryCode: {
                            getValue: function () {
                                return 'US';
                            }
                        },
                        postalCode: '10001',
                        stateCode: 'NY',
                        city: 'New York'
                    };
                },
                productLineItems: [
                    {
                        productID: 'sku-1',
                        quantityValue: 2
                    }
                ]
            };
        }

        it('builds quote requests only for CDS-mapped shipping methods', function () {
            var hook = loadQuoteHook({ ok: false });
            var groups = hook._private.buildQuoteRequests(shipment(), [
                { id: 'MappedShipping' },
                { id: 'UnmappedShipping' }
            ]);

            expect(groups).to.have.length(1);
            expect(groups[0].requestBody).to.deep.equal({
                deliveryEstimationSetupName: 'RefArch',
                shippingCarriers: [
                    {
                        name: 'UPSManage',
                        methods: [
                            { name: 'NON_PICKUP_DAYS_UPS' }
                        ]
                    }
                ],
                products: [
                    { stockKeepingUnit: 'sku-1', quantity: 2 }
                ],
                deliveryAddress: {
                    country: 'US',
                    postalCode: '10001',
                    state: 'NY',
                    city: 'New York'
                }
            });
        });

        it('maps CDS quote response to applicable shipping method delivery fields', function () {
            var mapped = { id: 'MappedShipping' };
            var unmapped = { id: 'UnmappedShipping' };
            var hook = loadQuoteHook({
                ok: true,
                object: {
                    deliveryEstimates: [
                        {
                            deliveryEstimateGroup: [
                                {
                                    shippingMethods: [
                                        {
                                            shippingCarrier: 'UPSManage',
                                            shippingCarrierMethod: 'NON_PICKUP_DAYS_UPS',
                                            estimatedDeliveryDate: {
                                                min: '2026-07-01T10:30:00',
                                                max: '2026-07-01T10:30:00'
                                            },
                                            orderCutoffTime: '2026-06-30T16:00:00'
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            });

            var status = hook.quote(shipment(), {
                applicableShippingMethods: [mapped, unmapped]
            });

            expect(status.status).to.equal(Status.OK);
            expect(mapped.deliveryWindow.startAt).to.be.an.instanceof(Date);
            expect(mapped.deliveryWindow.endAt).to.be.an.instanceof(Date);
            expect(mapped.deliveryWindow.startAt.getTime()).to.equal(new Date('2026-07-01T10:30:00').getTime());
            expect(mapped.deliveryWindow.endAt.getTime()).to.equal(new Date('2026-07-01T10:30:00').getTime());
            expect(mapped.orderCutoffAt).to.be.an.instanceof(Date);
            expect(mapped.orderCutoffAt.getTime()).to.equal(new Date('2026-06-30T16:00:00').getTime());
            expect(unmapped.deliveryWindow).to.equal(undefined);
        });
    });

    describe('calculate hook', function () {
        function Status(status, code, message) {
            this.status = status;
            this.code = code;
            this.message = message;
        }
        Status.OK = 'OK';
        Status.ERROR = 'ERROR';

        function logger() {
            return {
                warn: function () {},
                info: function () {},
                error: function () {}
            };
        }

        function loadCalculateHook(serviceResult) {
            var requestBuilderMock = {
                toArray: function (value) {
                    if (!value) return [];
                    return Array.isArray(value) ? value : value.toArray();
                },
                buildShippingMethodsById: function () {
                    return {
                        MappedShipping: {
                            custom: {
                                cdsShippingCarrier: 'UPSManage',
                                cdsMethodName: 'NON_PICKUP_DAYS_UPS'
                            }
                        }
                    };
                },
                resolveMethod: function (option, shippingMethodsById) {
                    var method = shippingMethodsById[option.shippingMethodId];
                    if (!method) return null;
                    return {
                        carrier: method.custom.cdsShippingCarrier,
                        methodName: method.custom.cdsMethodName
                    };
                }
            };
            var shipmentHelper = proxyquire('../../cartridge/scripts/helpers/shipmentDeliveryEstimateHelper', {
                '~/cartridge/scripts/config/cdsShippingConfig': {
                    getDeliveryEstimationSetupName: function () {
                        return 'RefArch';
                    }
                },
                '~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder': requestBuilderMock
            });

            return proxyquire('../../cartridge/scripts/hooks/calculate', {
                'dw/system/Logger': { getLogger: logger },
                'dw/system/Status': Status,
                'dw/order/ShippingMgr': {
                    applyShippingCost: function () {}
                },
                '~/cartridge/scripts/helpers/deliveryEstimateRequestBuilder': requestBuilderMock,
                '~/cartridge/scripts/helpers/shipmentDeliveryEstimateHelper': shipmentHelper,
                '~/cartridge/scripts/services/cdsShippingService': {
                    callDeliveryEstimation: function () {
                        return serviceResult;
                    }
                }
            });
        }

        function calculateShipment() {
            return {
                custom: {},
                getShippingMethod: function () {
                    return { ID: 'MappedShipping' };
                },
                getShippingAddress: function () {
                    return {
                        countryCode: {
                            getValue: function () {
                                return 'US';
                            }
                        },
                        postalCode: '10001',
                        stateCode: 'NY',
                        city: 'New York'
                    };
                },
                productLineItems: [
                    {
                        productID: 'sku-1',
                        quantityValue: 2
                    }
                ]
            };
        }

        it('builds calculate request for selected CDS-mapped shipping method', function () {
            var hook = loadCalculateHook({ ok: false });
            var request = hook._private.buildCalculateRequest(calculateShipment());

            expect(request.resolvedMethodName).to.equal('NON_PICKUP_DAYS_UPS');
            expect(request.requestBody).to.deep.equal({
                deliveryEstimationSetupName: 'RefArch',
                shippingCarriers: [
                    {
                        name: 'UPSManage',
                        methods: [
                            { name: 'NON_PICKUP_DAYS_UPS' }
                        ]
                    }
                ],
                products: [
                    { stockKeepingUnit: 'sku-1', quantity: 2 }
                ],
                deliveryAddress: {
                    country: 'US',
                    postalCode: '10001',
                    state: 'NY',
                    city: 'New York'
                }
            });
        });

        it('stores CDS delivery metadata on shipment custom fields', function () {
            var shipment = calculateShipment();
            var hook = loadCalculateHook({
                ok: true,
                object: {
                    deliveryEstimates: [
                        {
                            deliveryEstimateGroup: [
                                {
                                    shippingMethods: [
                                        {
                                            shippingCarrierMethod: 'NON_PICKUP_DAYS_UPS',
                                            estimatedDeliveryDate: {
                                                min: '2026-07-01T10:30:00',
                                                max: '2026-07-02T10:30:00'
                                            },
                                            orderCutoffTime: '2026-06-30T16:00:00'
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            });

            var status = hook.calculate({ shipments: [shipment] });

            expect(status.status).to.equal(Status.OK);
            expect(shipment.custom.deliveryWindowStartAt).to.be.an.instanceof(Date);
            expect(shipment.custom.deliveryWindowEndAt).to.be.an.instanceof(Date);
            expect(shipment.custom.orderCutoffAt).to.be.an.instanceof(Date);
            expect(shipment.custom.deliveryWindowStartAt.getTime()).to.equal(new Date('2026-07-01T10:30:00').getTime());
            expect(shipment.custom.deliveryWindowEndAt.getTime()).to.equal(new Date('2026-07-02T10:30:00').getTime());
            expect(shipment.custom.orderCutoffAt.getTime()).to.equal(new Date('2026-06-30T16:00:00').getTime());
        });
    });
});
