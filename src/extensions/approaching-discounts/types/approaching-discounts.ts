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
import type { ShopperBasketsV2 } from '@/scapi';

type ApproachingDiscount = ShopperBasketsV2.schemas['ApproachingDiscount'];

/**
 * A single approaching-discount, normalized for rendering.
 *
 * Derived from the SCAPI `ApproachingDiscount` (present on the basket only when the
 * `expand=approaching_discounts` query param is requested). All numeric fields are
 * coerced to concrete numbers so the component never has to guard `undefined`.
 */
export interface ApproachingDiscountView {
    /** Stable key for React lists — promotion id when available, else a positional fallback. */
    id: string;
    /** Whether the promotion is order-level or shipping-level. Selects the message copy. */
    type: 'order' | 'shipping';
    /** Total spend needed to unlock the promotion. */
    threshold: number;
    /** Amount the basket currently contributes toward the threshold. */
    merchandiseTotal: number;
    /** Remaining spend to qualify. Clamped at 0 (never negative). */
    amountRemaining: number;
    /** Fill fraction for the progress bar, 0–1. */
    progress: number;
    /** True once the basket meets or exceeds the threshold (achieved/success state). */
    achieved: boolean;
    /** Human-readable promotion label, e.g. "Free Shipping". Empty when unknown. */
    label: string;
    /** ISO 4217 currency code from the basket. Fallback to site currency. */
    currency: string;
}

/** Clamp a value into the inclusive [min, max] range. */
function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Normalize a raw SCAPI `ApproachingDiscount` into an {@link ApproachingDiscountView}.
 *
 * @param discount - The raw approaching-discount entry from `basket.approachingDiscounts`.
 * @param currency - ISO 4217 currency code from the basket. Fallback to site currency.
 * @returns A view-model with all numeric fields resolved, or `null` when the entry has no
 *          usable threshold (a zero/negative threshold cannot produce a meaningful bar).
 */
export function toApproachingDiscountView(
    discount: ApproachingDiscount,
    currency: string
): ApproachingDiscountView | null {
    const threshold = discount.conditionThreshold ?? 0;
    if (threshold <= 0) {
        return null;
    }

    const merchandiseTotal = Math.max(0, discount.merchandiseTotal ?? 0);
    const amountRemaining = Math.max(0, threshold - merchandiseTotal);
    const achieved = merchandiseTotal >= threshold;

    return {
        id: discount.promotionLink?.promotionId ?? `approaching-discount-${discount.type}-${threshold}`,
        type: discount.type,
        threshold,
        merchandiseTotal,
        amountRemaining,
        progress: clamp(merchandiseTotal / threshold, 0, 1),
        achieved,
        label: discount.promotionLink?.name ?? '',
        currency,
    };
}

/**
 * Build a view for an *achieved* promotion, derived from an applied basket adjustment rather
 * than an `ApproachingDiscount`.
 *
 * @param promotionId - The applied promotion's id, used as the stable React key.
 * @param type - Order- or shipping-level, selecting the success copy.
 * @param label - Human-readable promotion label (the adjustment's `itemText`).
 * @param currency - ISO 4217 currency code from the basket. Fallback to site currency.
 * @returns An {@link ApproachingDiscountView} flagged `achieved`.
 */
export function toAchievedView(
    promotionId: string,
    type: 'order' | 'shipping',
    label: string,
    currency: string
): ApproachingDiscountView {
    return {
        id: promotionId,
        type,
        threshold: 0,
        merchandiseTotal: 0,
        amountRemaining: 0,
        progress: 1,
        achieved: true,
        label,
        currency,
    };
}
