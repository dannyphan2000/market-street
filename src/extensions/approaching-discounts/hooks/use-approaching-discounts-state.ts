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
import { useMemo } from 'react';
import type { ShopperBasketsV2 } from '@/scapi';
import { useBasket } from '@/providers/basket';
import {
    toApproachingDiscountView,
    type ApproachingDiscountView,
} from '@/extensions/approaching-discounts/types/approaching-discounts';

type Basket = ShopperBasketsV2.schemas['Basket'];

/**
 * A single promotion's derived state, tagged by `promotionId`. `approaching` carries the
 * normalized {@link ApproachingDiscountView}; `achieved` carries just the applied promotion's
 * `type` and `label`.
 */
export type DerivedDiscountState =
    | { promotionId: string; state: 'approaching'; view: ApproachingDiscountView }
    | { promotionId: string; state: 'achieved'; type: 'order' | 'shipping'; label: string; currency: string };

/** An applied promotion's type and human-readable label, keyed by `promotionId`. */
interface AchievedPromotion {
    type: 'order' | 'shipping';
    /** Label for the success copy — the adjustment's `itemText` (the promotion name). */
    label: string;
}

/**
 * Collect every promotion already applied to the basket, keyed by `promotionId`. A promotion is
 * "achieved" the moment its adjustment appears in the totals — order promotions land in
 * `orderPriceAdjustments`, shipping promotions in each shipment's `priceAdjustments`.
 */
function collectAchievedPromotions(basket: Basket | undefined): Map<string, AchievedPromotion> {
    const achieved = new Map<string, AchievedPromotion>();

    for (const adjustment of basket?.orderPriceAdjustments ?? []) {
        if (adjustment.promotionId && !achieved.has(adjustment.promotionId)) {
            achieved.set(adjustment.promotionId, { type: 'order', label: adjustment.itemText ?? '' });
        }
    }

    for (const shipment of basket?.shippingItems ?? []) {
        for (const adjustment of shipment.priceAdjustments ?? []) {
            if (adjustment.promotionId && !achieved.has(adjustment.promotionId)) {
                achieved.set(adjustment.promotionId, { type: 'shipping', label: adjustment.itemText ?? '' });
            }
        }
    }

    return achieved;
}

/**
 * Derive the approaching-vs-achieved promotion state from a basket, joining approaching
 * discounts and applied adjustments on `promotionId`.
 *
 * @param basket - The expanded basket (may be `undefined` before hydration).
 * @returns One {@link DerivedDiscountState} per displayable promotion, tagged by `promotionId`.
 */
export function deriveApproachingDiscountsState(basket: Basket | undefined): DerivedDiscountState[] {
    const achieved = collectAchievedPromotions(basket);
    const states: DerivedDiscountState[] = [];
    const seen = new Set<string>();
    const currency = basket?.currency ?? '';

    const discounts = basket?.approachingDiscounts ?? [];
    for (let index = 0; index < discounts.length; index += 1) {
        const view = toApproachingDiscountView(discounts[index], currency);
        if (!view) {
            continue;
        }
        const applied = achieved.get(view.id);
        if (applied) {
            states.push({
                promotionId: view.id,
                state: 'achieved',
                type: applied.type,
                label: applied.label,
                currency,
            });
        } else {
            states.push({ promotionId: view.id, state: 'approaching', view });
        }
        seen.add(view.id);
    }

    for (const [promotionId, { type, label }] of achieved) {
        if (!seen.has(promotionId)) {
            states.push({ promotionId, state: 'achieved', type, label, currency });
        }
    }

    return states;
}

/**
 * Read the current basket from context and derive the approaching-vs-achieved promotion state.
 *
 * @returns The derived state list, keyed by `promotionId` (empty until the expanded basket loads).
 */
export function useApproachingDiscountsState(): DerivedDiscountState[] {
    const basket = useBasket();
    return useMemo(() => deriveApproachingDiscountsState(basket), [basket]);
}
