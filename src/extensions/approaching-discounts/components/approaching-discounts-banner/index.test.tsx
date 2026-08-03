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
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import ApproachingDiscountsBanner from './index';
import { AllProvidersWrapper } from '@/test-utils/context-provider';
import type { ApproachingDiscountView } from '@/extensions/approaching-discounts/types/approaching-discounts';

// Render the Trans children/values so assertions can target the interpolated copy.
// Interpolation tokens are echoed as "{{amount}}"/"{{discount}}" replacements.
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: { language: 'en-US' },
        t: (key: string, values?: Record<string, string>) => {
            if (values) {
                return Object.entries(values).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), key);
            }
            return key;
        },
    }),
    Trans: ({ i18nKey, values }: { i18nKey: string; values?: Record<string, string> }): ReactNode => {
        const rendered = values ? Object.entries(values).reduce((acc, [k, v]) => `${acc} ${k}:${v}`, i18nKey) : i18nKey;
        return <>{rendered}</>;
    },
}));

function baseView(overrides: Partial<ApproachingDiscountView> = {}): ApproachingDiscountView {
    return {
        id: 'promo-1',
        type: 'order',
        threshold: 100,
        merchandiseTotal: 60,
        amountRemaining: 40,
        progress: 0.6,
        achieved: false,
        label: '10% off $100 orders',
        currency: 'USD',
        ...overrides,
    };
}

function renderBanner(view: ApproachingDiscountView) {
    return render(
        <AllProvidersWrapper>
            <ApproachingDiscountsBanner discount={view} />
        </AllProvidersWrapper>
    );
}

describe('ApproachingDiscountsBanner', () => {
    it('renders the approaching message with the remaining amount and label', () => {
        renderBanner(baseView());

        const banner = screen.getByTestId('approaching-discounts-banner');
        expect(banner).toHaveAttribute('data-state', 'approaching');
        // amount interpolated by the Trans mock; $40.00 comes from formatCurrency
        expect(banner).toHaveTextContent('banner.approaching');
        expect(banner).toHaveTextContent('amount:$40.00');
        expect(banner).toHaveTextContent('discount:10% off $100 orders');
    });

    it('renders the achieved message when the threshold is met', () => {
        renderBanner(baseView({ achieved: true, merchandiseTotal: 120, amountRemaining: 0, progress: 1 }));

        const banner = screen.getByTestId('approaching-discounts-banner');
        expect(banner).toHaveAttribute('data-state', 'achieved');
        expect(banner).toHaveTextContent('banner.achieved');
        expect(banner).toHaveTextContent('discount:10% off $100 orders');
    });

    it('renders a shipping-type discount', () => {
        renderBanner(baseView({ type: 'shipping', label: 'Free Shipping' }));

        expect(screen.getByTestId('approaching-discounts-banner')).toHaveTextContent('discount:Free Shipping');
    });

    it('uses the localized fallback label when the promotion has no name', () => {
        renderBanner(baseView({ label: '', type: 'shipping' }));

        // Falls back to the `banner.fallbackDiscount.shipping` key via t()
        expect(screen.getByTestId('approaching-discounts-banner')).toHaveTextContent(
            'discount:banner.fallbackDiscount.shipping'
        );
    });

    it('exposes an accessible progressbar wired to the merchandise total and threshold', () => {
        renderBanner(baseView());

        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuemin', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '100');
        expect(bar).toHaveAttribute('aria-valuenow', '60');
        expect(bar).toHaveAttribute('aria-valuetext');
    });

    it('clamps aria-valuenow to the threshold once the discount is achieved', () => {
        renderBanner(baseView({ achieved: true, merchandiseTotal: 120, amountRemaining: 0, progress: 1 }));

        const bar = screen.getByRole('progressbar');
        // merchandiseTotal (120) exceeds the threshold (100); aria-valuenow must not exceed aria-valuemax.
        expect(bar).toHaveAttribute('aria-valuemax', '100');
        expect(bar).toHaveAttribute('aria-valuenow', '100');
    });

    it('links the progressbar accessible name to the banner message', () => {
        renderBanner(baseView());

        const bar = screen.getByRole('progressbar');
        const labelledBy = bar.getAttribute('aria-labelledby');
        expect(labelledBy).toBeTruthy();
        expect(document.getElementById(labelledBy as string)).toHaveTextContent('banner.approaching');
    });

    it('renders currency endpoint captions for the range 0 to threshold', () => {
        renderBanner(baseView());

        expect(screen.getByText('$0.00')).toBeInTheDocument();
        expect(screen.getByText('$100.00')).toBeInTheDocument();
    });

    // The amounts are basket-derived, so the banner must format with the basket's currency even
    // when the site currency differs (mid-session switch, before the basket recalc lands).
    it('formats amounts with the basket currency, not the site currency', () => {
        render(
            <AllProvidersWrapper currency="USD">
                <ApproachingDiscountsBanner discount={baseView({ currency: 'EUR' })} />
            </AllProvidersWrapper>
        );

        // €-formatted endpoints, not $ — the view currency (EUR) wins over the site currency (USD).
        expect(screen.getByText('€0.00')).toBeInTheDocument();
        expect(screen.getByText('€100.00')).toBeInTheDocument();
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    });

    it('falls back to the site currency when the view has no basket currency', () => {
        render(
            <AllProvidersWrapper currency="GBP">
                <ApproachingDiscountsBanner discount={baseView({ currency: '' })} />
            </AllProvidersWrapper>
        );

        // Empty view currency → site currency (GBP) is used for formatting.
        expect(screen.getByText('£0.00')).toBeInTheDocument();
        expect(screen.getByText('£100.00')).toBeInTheDocument();
    });

    // An achieved promotion derived from an applied adjustment has no threshold (SCAPI dropped it),
    // so the bar renders full on a normalized 0–1 range with no currency captions.
    it('renders a full bar with no endpoint captions and a valid range when the achieved view has no threshold', () => {
        renderBanner(baseView({ achieved: true, threshold: 0, merchandiseTotal: 0, amountRemaining: 0, progress: 1 }));

        const banner = screen.getByTestId('approaching-discounts-banner');
        expect(banner).toHaveAttribute('data-state', 'achieved');
        expect(banner).toHaveTextContent('banner.achieved');

        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuemin', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '1');
        expect(bar).toHaveAttribute('aria-valuenow', '1');

        // No currency endpoint captions when there is no range to show.
        expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    });

    it('shows the message by default (showMessage defaults to true)', () => {
        renderBanner(baseView());

        const message = document.getElementById(
            screen.getByRole('progressbar').getAttribute('aria-labelledby') as string
        );
        expect(message).not.toHaveClass('sr-only');
    });

    it('visually hides the message when showMessage is false, keeping it for screen readers and the progressbar accessible name', () => {
        render(
            <AllProvidersWrapper>
                <ApproachingDiscountsBanner discount={baseView()} showMessage={false} />
            </AllProvidersWrapper>
        );

        const bar = screen.getByRole('progressbar');
        const labelledBy = bar.getAttribute('aria-labelledby');
        const message = document.getElementById(labelledBy as string);
        // Still in the DOM (progressbar aria-labelledby resolves) but visually hidden via sr-only.
        expect(message).toBeInTheDocument();
        expect(message).toHaveClass('sr-only');
        expect(message).toHaveTextContent('banner.approaching');
        // The progress bar still renders regardless of message visibility.
        expect(bar).toBeInTheDocument();
    });

    it('shows the progress bar by default (showProgressBar defaults to true)', () => {
        renderBanner(baseView());

        // No sr-only wrapper around the progress bar when visible.
        const bar = screen.getByRole('progressbar');
        expect(bar.closest('.sr-only')).toBeNull();
    });

    it('visually hides the progress bar when showProgressBar is false, keeping it for screen readers', () => {
        render(
            <AllProvidersWrapper>
                <ApproachingDiscountsBanner discount={baseView()} showProgressBar={false} />
            </AllProvidersWrapper>
        );

        const bar = screen.getByRole('progressbar');
        // Still in the DOM (a11y tree) but visually hidden via an sr-only wrapper.
        expect(bar).toBeInTheDocument();
        expect(bar.closest('.sr-only')).not.toBeNull();
        // The message still renders regardless of progress-bar visibility.
        const message = document.getElementById(bar.getAttribute('aria-labelledby') as string);
        expect(message).toBeInTheDocument();
        expect(message).not.toHaveClass('sr-only');
    });
});
