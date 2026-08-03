/**
 * Copyright 2026 Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** @sfdc-extension-file SFDC_EXT_APPROACHING_DISCOUNTS */
import { type ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, useInRouterContext } from 'react-router';
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { SiteProvider } from '@salesforce/storefront-next-runtime/site-context';
import BasketProvider from '@/providers/basket';
import type { ShopperBasketsV2 } from '@/scapi';
import { mockConfig, mockLocale, mockSiteObject } from '@/test-utils/config';

type Basket = ShopperBasketsV2.schemas['Basket'];

/**
 * A basket carrying one order-level approaching-discount, so the surface renders the real
 * banner in its "approaching" state. `approachingDiscounts` is populated only when the basket
 * was fetched with SCAPI `expand=approaching_discounts`.
 */
export const orderDiscountBasket: Basket = {
    approachingDiscounts: [
        {
            type: 'order',
            conditionThreshold: 100,
            merchandiseTotal: 68.49,
            promotionLink: { promotionId: 'order-promo', name: '10% off your order' },
        },
    ],
} as Basket;

/**
 * A basket carrying one order-level and one shipping-level approaching-discount, so the surface
 * can render more than one banner when `maxDiscounts` is raised above the default of 1.
 */
export const multipleDiscountsBasket: Basket = {
    approachingDiscounts: [
        {
            type: 'order',
            conditionThreshold: 100,
            merchandiseTotal: 68.49,
            promotionLink: { promotionId: 'order-promo', name: '10% off your order' },
        },
        {
            type: 'shipping',
            conditionThreshold: 75,
            merchandiseTotal: 68.49,
            promotionLink: { promotionId: 'shipping-promo', name: 'Free shipping' },
        },
    ],
} as Basket;

/** A basket with no approaching-discounts, so the surface renders nothing. */
export const emptyBasket: Basket = { approachingDiscounts: [] } as Basket;

/**
 * Storybook decorator that supplies the config, site, router, and basket context the surface
 * needs. The surface reads `useBasket()` and renders the banner, which reads `useSite()` for
 * currency — so the providers must be present.
 *
 * @param basket - The basket to expose via {@link BasketProvider} (drives the banner state).
 */
export const discountSurfaceDecorator = (basket: Basket) => {
    const Decorator = (Story: React.ComponentType): ReactElement => {
        const inRouter = useInRouterContext();
        const content = (
            <ConfigProvider config={mockConfig}>
                <SiteProvider
                    site={mockSiteObject}
                    locale={mockLocale}
                    language={mockSiteObject.defaultLocale}
                    currency={mockSiteObject.defaultCurrency}>
                    <BasketProvider basket={basket}>
                        <div className="w-96 p-6">
                            <Story />
                        </div>
                    </BasketProvider>
                </SiteProvider>
            </ConfigProvider>
        );

        if (inRouter) return content;

        const router = createMemoryRouter([{ path: '/', element: content }], { initialEntries: ['/'] });
        return <RouterProvider router={router} />;
    };
    Decorator.displayName = 'DiscountSurfaceDecorator';
    return Decorator;
};
