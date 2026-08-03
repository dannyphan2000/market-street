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
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import { type ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, useInRouterContext } from 'react-router';
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { SiteProvider } from '@salesforce/storefront-next-runtime/site-context';
import { mockConfig, mockLocale, mockSiteObject } from '@/test-utils/config';
import ApproachingDiscountsBanner from '../index';

const meta: Meta<typeof ApproachingDiscountsBanner> = {
    title: 'Extensions/Approaching Discounts/Banner',
    component: ApproachingDiscountsBanner,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Threshold-nudge banner for approaching promotions. Prop-driven and surface-agnostic — the cart, mini-cart, and checkout target wrappers select the top approaching-discount and pass it in. Renders an "approaching" state (progress bar + amount remaining) or an "achieved" state (full bar + success copy).',
            },
        },
    },
    decorators: [
        (Story: React.ComponentType) => {
            const RouterWrapper = (): ReactElement => {
                const inRouter = useInRouterContext();
                const content = (
                    <ConfigProvider config={mockConfig}>
                        <SiteProvider
                            site={mockSiteObject}
                            locale={mockLocale}
                            language={mockSiteObject.defaultLocale}
                            currency={mockSiteObject.defaultCurrency}>
                            <div className="w-96 p-6">
                                <Story />
                            </div>
                        </SiteProvider>
                    </ConfigProvider>
                );

                if (inRouter) return content;

                const router = createMemoryRouter([{ path: '/', element: content }], {
                    initialEntries: ['/'],
                });
                return <RouterProvider router={router} />;
            };

            return <RouterWrapper />;
        },
    ],
};

export default meta;
type Story = StoryObj<typeof ApproachingDiscountsBanner>;

export const ApproachingOrderDiscount: Story = {
    args: {
        discount: {
            id: 'order-promo',
            type: 'order',
            threshold: 100,
            merchandiseTotal: 68.49,
            amountRemaining: 31.51,
            progress: 0.6849,
            achieved: false,
            label: '10% off your order',
            currency: 'USD',
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const banner = canvas.getByTestId('approaching-discounts-banner');
        expect(banner).toHaveAttribute('data-state', 'approaching');
        expect(canvas.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '68.49');
    },
};

export const ApproachingFreeShipping: Story = {
    args: {
        discount: {
            id: 'shipping-promo',
            type: 'shipping',
            threshold: 60,
            merchandiseTotal: 28.49,
            amountRemaining: 31.51,
            progress: 0.4748,
            achieved: false,
            label: 'Free Shipping',
            currency: 'USD',
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        expect(canvas.getByTestId('approaching-discounts-banner')).toHaveAttribute('data-state', 'approaching');
    },
};

export const HiddenMessage: Story = {
    args: {
        showMessage: false,
        discount: {
            id: 'order-promo',
            type: 'order',
            threshold: 100,
            merchandiseTotal: 68.49,
            amountRemaining: 31.51,
            progress: 0.6849,
            achieved: false,
            label: '10% off your order',
            currency: 'USD',
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        // Progress bar still renders; the message is visually hidden (sr-only) but kept for a11y.
        const bar = canvas.getByRole('progressbar');
        expect(bar).toBeInTheDocument();
        // getElementById is format-agnostic — avoids coupling to React's useId() id syntax.
        const message = canvasElement.ownerDocument.getElementById(bar.getAttribute('aria-labelledby') as string);
        expect(message).toHaveClass('sr-only');
    },
};

export const HiddenProgressBar: Story = {
    args: {
        showProgressBar: false,
        discount: {
            id: 'order-promo',
            type: 'order',
            threshold: 100,
            merchandiseTotal: 68.49,
            amountRemaining: 31.51,
            progress: 0.6849,
            achieved: false,
            label: '10% off your order',
            currency: 'USD',
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        // Progress bar still renders but is visually hidden (sr-only) on its wrapper, kept for a11y.
        const bar = canvas.getByRole('progressbar');
        expect(bar).toBeInTheDocument();
        expect(bar.closest('.sr-only')).not.toBeNull();
        // getElementById is format-agnostic — avoids coupling to React's useId() id syntax.
        const message = canvasElement.ownerDocument.getElementById(bar.getAttribute('aria-labelledby') as string);
        expect(message).not.toHaveClass('sr-only');
    },
};

export const AchievedDiscount: Story = {
    args: {
        discount: {
            id: 'shipping-promo',
            type: 'shipping',
            threshold: 60,
            merchandiseTotal: 105,
            amountRemaining: 0,
            progress: 1,
            achieved: true,
            label: 'Free Shipping',
            currency: 'USD',
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);
        const banner = canvas.getByTestId('approaching-discounts-banner');
        expect(banner).toHaveAttribute('data-state', 'achieved');
        // merchandiseTotal (105) is clamped to the threshold (60) so aria-valuenow never exceeds aria-valuemax.
        expect(canvas.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
    },
};
