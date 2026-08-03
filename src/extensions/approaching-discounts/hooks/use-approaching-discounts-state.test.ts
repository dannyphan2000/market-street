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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ShopperBasketsV2 } from '@/scapi';
import { deriveApproachingDiscountsState, useApproachingDiscountsState } from './use-approaching-discounts-state';

vi.mock('@/providers/basket', () => ({
    useBasket: vi.fn(),
}));

type Basket = ShopperBasketsV2.schemas['Basket'];
type ApproachingDiscount = ShopperBasketsV2.schemas['ApproachingDiscount'];

function approaching(overrides: Partial<ApproachingDiscount> = {}): ApproachingDiscount {
    return {
        type: 'order',
        conditionThreshold: 100,
        merchandiseTotal: 60,
        promotionLink: { promotionId: 'promo-1', name: '10% off $100 orders' },
        ...overrides,
    };
}

describe('deriveApproachingDiscountsState', () => {
    it('returns an empty list when the basket is undefined', () => {
        expect(deriveApproachingDiscountsState(undefined)).toEqual([]);
    });

    it('returns an empty list when approachingDiscounts is absent (no expand)', () => {
        expect(deriveApproachingDiscountsState({} as Basket)).toEqual([]);
    });

    it('drops entries whose view is invalid (non-positive threshold)', () => {
        const basket = {
            approachingDiscounts: [approaching({ conditionThreshold: 0 })],
        } as unknown as Basket;

        expect(deriveApproachingDiscountsState(basket)).toEqual([]);
    });

    // AC2 / AC7 — order-approaching
    it('tags an order promotion still below threshold as approaching', () => {
        const basket = {
            currency: 'EUR',
            approachingDiscounts: [approaching({ type: 'order' })],
        } as unknown as Basket;

        const [entry, ...rest] = deriveApproachingDiscountsState(basket);
        expect(rest).toHaveLength(0);
        expect(entry.promotionId).toBe('promo-1');
        expect(entry.state).toBe('approaching');
        if (entry.state === 'approaching') {
            expect(entry.view.type).toBe('order');
            expect(entry.view.amountRemaining).toBe(40);
            // The approaching view is denominated in the basket currency, not the site currency.
            expect(entry.view.currency).toBe('EUR');
        }
    });

    // AC4 / AC7 — shipping-approaching
    it('tags a shipping promotion still below threshold as approaching', () => {
        const basket = {
            approachingDiscounts: [
                approaching({ type: 'shipping', promotionLink: { promotionId: 'ship-1', name: 'Free Shipping' } }),
            ],
        } as unknown as Basket;

        const [entry] = deriveApproachingDiscountsState(basket);
        expect(entry.state).toBe('approaching');
        if (entry.state === 'approaching') {
            expect(entry.view.type).toBe('shipping');
        }
    });

    // AC3 / AC7 — order-achieved
    it('tags an order promotion as achieved when it appears in orderPriceAdjustments', () => {
        const basket = {
            currency: 'USD',
            approachingDiscounts: [approaching({ type: 'order' })],
            orderPriceAdjustments: [{ promotionId: 'promo-1', itemText: '10% off $100 orders' }],
        } as unknown as Basket;

        const [entry] = deriveApproachingDiscountsState(basket);
        expect(entry).toEqual({
            promotionId: 'promo-1',
            state: 'achieved',
            type: 'order',
            label: '10% off $100 orders',
            currency: 'USD',
        });
    });

    // AC4 / AC7 — shipping-achieved
    it('tags a shipping promotion as achieved when it appears in a shipment priceAdjustments', () => {
        const basket = {
            currency: 'USD',
            approachingDiscounts: [
                approaching({ type: 'shipping', promotionLink: { promotionId: 'ship-1', name: 'Free Shipping' } }),
            ],
            shippingItems: [{ priceAdjustments: [{ promotionId: 'ship-1', itemText: 'Free Shipping' }] }],
        } as unknown as Basket;

        const [entry] = deriveApproachingDiscountsState(basket);
        expect(entry).toEqual({
            promotionId: 'ship-1',
            state: 'achieved',
            type: 'shipping',
            label: 'Free Shipping',
            currency: 'USD',
        });
    });

    // A promotion applied as BOTH an order and a shipping adjustment (same promotionId) must keep
    // its order classification — first-write-wins — so the type label is not silently flipped.
    it('keeps the order classification when the same promotionId is applied as both order and shipping', () => {
        const basket = {
            currency: 'USD',
            approachingDiscounts: null,
            orderPriceAdjustments: [{ promotionId: 'dup-promo', itemText: 'Order label' }],
            shippingItems: [{ priceAdjustments: [{ promotionId: 'dup-promo', itemText: 'Shipping label' }] }],
        } as unknown as Basket;

        const states = deriveApproachingDiscountsState(basket);
        expect(states).toEqual([
            { promotionId: 'dup-promo', state: 'achieved', type: 'order', label: 'Order label', currency: 'USD' },
        ]);
    });

    // Achieved after SCAPI drops the promo from approachingDiscounts (the real crossing-over case)
    it('tags a promotion as achieved from the applied adjustment even when absent from approachingDiscounts', () => {
        const basket = {
            currency: 'USD',
            approachingDiscounts: null,
            orderPriceAdjustments: [{ promotionId: 'promo-1', itemText: 'Test approaching order discount' }],
        } as unknown as Basket;

        const states = deriveApproachingDiscountsState(basket);
        expect(states).toEqual([
            {
                promotionId: 'promo-1',
                state: 'achieved',
                type: 'order',
                label: 'Test approaching order discount',
                currency: 'USD',
            },
        ]);
    });

    // AC5 — achieved wins when a promotion is in both sources
    it('prefers achieved when the same promotionId is both approaching and adjusted (achieved wins)', () => {
        const basket = {
            approachingDiscounts: [approaching({ type: 'order' })],
            orderPriceAdjustments: [{ promotionId: 'promo-1' }],
        } as unknown as Basket;

        const states = deriveApproachingDiscountsState(basket);
        expect(states).toHaveLength(1);
        expect(states[0].state).toBe('achieved');
    });

    it('derives a mixed list keyed by promotionId, preserving SCAPI order', () => {
        const basket = {
            approachingDiscounts: [
                approaching({ type: 'order', promotionLink: { promotionId: 'order-approaching' } }),
                approaching({ type: 'order', promotionLink: { promotionId: 'order-achieved' } }),
                approaching({ type: 'shipping', promotionLink: { promotionId: 'ship-achieved' } }),
            ],
            orderPriceAdjustments: [{ promotionId: 'order-achieved' }],
            shippingItems: [{ priceAdjustments: [{ promotionId: 'ship-achieved' }] }],
        } as unknown as Basket;

        expect(deriveApproachingDiscountsState(basket).map((s) => [s.promotionId, s.state])).toEqual([
            ['order-approaching', 'approaching'],
            ['order-achieved', 'achieved'],
            ['ship-achieved', 'achieved'],
        ]);
    });

    // AC8 — transitions
    it('flips approaching -> achieved when the shopper crosses the threshold', () => {
        const before = {
            approachingDiscounts: [approaching({ merchandiseTotal: 60 })],
        } as unknown as Basket;
        const after = {
            approachingDiscounts: [approaching({ merchandiseTotal: 100 })],
            orderPriceAdjustments: [{ promotionId: 'promo-1' }],
        } as unknown as Basket;

        expect(deriveApproachingDiscountsState(before)[0].state).toBe('approaching');
        expect(deriveApproachingDiscountsState(after)[0].state).toBe('achieved');
    });

    it('flips achieved -> approaching when the shopper drops back below the threshold', () => {
        const achievedBasket = {
            approachingDiscounts: [approaching({ merchandiseTotal: 100 })],
            orderPriceAdjustments: [{ promotionId: 'promo-1' }],
        } as unknown as Basket;
        const droppedBasket = {
            approachingDiscounts: [approaching({ merchandiseTotal: 60 })],
        } as unknown as Basket;

        expect(deriveApproachingDiscountsState(achievedBasket)[0].state).toBe('achieved');
        expect(deriveApproachingDiscountsState(droppedBasket)[0].state).toBe('approaching');
    });

    it('ignores price adjustments with no promotionId', () => {
        const basket = {
            approachingDiscounts: [approaching()],
            orderPriceAdjustments: [{ couponCode: 'FREE' }],
            shippingItems: [{ priceAdjustments: [{ manual: true }] }],
        } as unknown as Basket;

        expect(deriveApproachingDiscountsState(basket)[0].state).toBe('approaching');
    });
});

describe('useApproachingDiscountsState', () => {
    let mockUseBasket: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { useBasket } = await import('@/providers/basket');
        mockUseBasket = useBasket as unknown as ReturnType<typeof vi.fn>;
    });

    it('derives state from the basket in context', () => {
        mockUseBasket.mockReturnValue({
            approachingDiscounts: [approaching()],
        } as unknown as Basket);

        const { result } = renderHook(() => useApproachingDiscountsState());

        expect(result.current).toHaveLength(1);
        expect(result.current[0].state).toBe('approaching');
    });

    it('returns a stable reference across re-renders while the basket is unchanged (memoized)', () => {
        const basket = { approachingDiscounts: [approaching()] } as unknown as Basket;
        mockUseBasket.mockReturnValue(basket);

        const { result, rerender } = renderHook(() => useApproachingDiscountsState());
        const first = result.current;
        rerender();

        expect(result.current).toBe(first);
    });

    it('reads the basket without opting in to auto-load', () => {
        mockUseBasket.mockReturnValue(undefined);

        renderHook(() => useApproachingDiscountsState());

        const args = mockUseBasket.mock.calls[0];
        expect(args[0]?.autoLoad).not.toBe(true);
    });
});
