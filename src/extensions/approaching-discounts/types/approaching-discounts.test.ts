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
import { describe, it, expect } from 'vitest';
import type { ShopperBasketsV2 } from '@/scapi';
import { toApproachingDiscountView, toAchievedView } from './approaching-discounts';

type ApproachingDiscount = ShopperBasketsV2.schemas['ApproachingDiscount'];

function makeDiscount(overrides: Partial<ApproachingDiscount> = {}): ApproachingDiscount {
    return {
        type: 'order',
        conditionThreshold: 100,
        merchandiseTotal: 60,
        promotionLink: { promotionId: 'promo-1', name: '10% off $100 orders' },
        ...overrides,
    };
}

describe('toApproachingDiscountView', () => {
    it('maps an approaching order-level discount with clamped remaining and progress', () => {
        const view = toApproachingDiscountView(makeDiscount(), 'USD');

        expect(view).not.toBeNull();
        expect(view).toMatchObject({
            id: 'promo-1',
            type: 'order',
            threshold: 100,
            merchandiseTotal: 60,
            amountRemaining: 40,
            achieved: false,
            label: '10% off $100 orders',
            currency: 'USD',
        });
        expect(view?.progress).toBeCloseTo(0.6);
    });

    it('carries the basket currency through to the view', () => {
        const view = toApproachingDiscountView(makeDiscount(), 'EUR');

        expect(view?.currency).toBe('EUR');
    });

    it('marks the discount achieved and clamps progress to 1 when total meets the threshold', () => {
        const view = toApproachingDiscountView(makeDiscount({ merchandiseTotal: 120 }), 'USD');

        expect(view?.achieved).toBe(true);
        expect(view?.amountRemaining).toBe(0);
        expect(view?.progress).toBe(1);
    });

    it('carries the shipping type through', () => {
        const view = toApproachingDiscountView(
            makeDiscount({ type: 'shipping', promotionLink: { promotionId: 'ship-1', name: 'Free Shipping' } }),
            'USD'
        );

        expect(view?.type).toBe('shipping');
        expect(view?.label).toBe('Free Shipping');
    });

    it('returns null when the threshold is missing or non-positive', () => {
        expect(toApproachingDiscountView(makeDiscount({ conditionThreshold: 0 }), 'USD')).toBeNull();
        expect(toApproachingDiscountView(makeDiscount({ conditionThreshold: undefined }), 'USD')).toBeNull();
    });

    it('falls back to an attribute-based id and empty label when the promotion link is absent', () => {
        const view = toApproachingDiscountView(makeDiscount({ promotionLink: undefined }), 'USD');

        // Fallback id keys on type + threshold (stable across SCAPI array reordering), not position.
        expect(view?.id).toBe('approaching-discount-order-100');
        expect(view?.label).toBe('');
    });

    it('keeps the fallback id stable regardless of the entry position in the source array', () => {
        const first = toApproachingDiscountView(makeDiscount({ promotionLink: undefined }), 'USD');
        const reordered = toApproachingDiscountView(makeDiscount({ promotionLink: undefined }), 'USD');

        // Same intrinsic promotion → same key, even if SCAPI moves it within approachingDiscounts.
        expect(first?.id).toBe(reordered?.id);
    });

    it('treats a missing merchandise total as zero', () => {
        const view = toApproachingDiscountView(makeDiscount({ merchandiseTotal: undefined }), 'USD');

        expect(view?.merchandiseTotal).toBe(0);
        expect(view?.amountRemaining).toBe(100);
        expect(view?.progress).toBe(0);
    });
});

describe('toAchievedView', () => {
    it('builds an achieved view with a full bar and no threshold range', () => {
        const view = toAchievedView('promo-1', 'order', 'Test approaching order discount', 'USD');

        expect(view).toEqual({
            id: 'promo-1',
            type: 'order',
            threshold: 0,
            merchandiseTotal: 0,
            amountRemaining: 0,
            progress: 1,
            achieved: true,
            label: 'Test approaching order discount',
            currency: 'USD',
        });
    });

    it('carries the shipping type through', () => {
        expect(toAchievedView('ship-1', 'shipping', 'Free Shipping', 'USD').type).toBe('shipping');
    });

    it('carries the basket currency through', () => {
        expect(toAchievedView('promo-1', 'order', 'label', 'GBP').currency).toBe('GBP');
    });
});
