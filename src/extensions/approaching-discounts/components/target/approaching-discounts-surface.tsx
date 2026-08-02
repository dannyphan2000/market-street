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
import ApproachingDiscountsBanner from '@/extensions/approaching-discounts/components/approaching-discounts-banner';
import { useApproachingDiscountsState } from '@/extensions/approaching-discounts/hooks/use-approaching-discounts-state';
import {
    toAchievedView,
    type ApproachingDiscountView,
} from '@/extensions/approaching-discounts/types/approaching-discounts';

export interface ApproachingDiscountsSurfaceProps {
    /** Maximum number of discount banners to render. Defaults to `1`. */
    maxDiscounts?: number;
    /** Whether to show the message above the progress bar (default `true`) */
    showMessage?: boolean;
    /** Whether to show the progress bar (default `true`) */
    showProgressBar?: boolean;
}

/**
 * The approaching-discounts banner, registered directly against all four UITarget slots
 * (checkout order-summary, cart order-summary, cart above-items, mini-cart).
 *
 * Reads the basket from context and surfaces the approaching discounts (up to maximum amount).
 * Which slots render is the `enabled` flag in `target-config.json`.
 */
export default function ApproachingDiscountsSurface({
    maxDiscounts = 1,
    showMessage = true,
    showProgressBar = true,
}: ApproachingDiscountsSurfaceProps = {}): ReactElement {
    const states = useApproachingDiscountsState();

    const approaching = states.flatMap((entry) => (entry.state === 'approaching' ? [entry.view] : []));
    const achieved = states.flatMap((entry) =>
        entry.state === 'achieved' ? [toAchievedView(entry.promotionId, entry.type, entry.label, entry.currency)] : []
    );

    const views: ApproachingDiscountView[] = [...approaching, ...achieved].slice(0, Math.max(0, maxDiscounts));

    return (
        <div aria-live="polite" aria-atomic="false">
            {views.map((view) => (
                <ApproachingDiscountsBanner
                    key={view.id}
                    discount={view}
                    showMessage={showMessage}
                    showProgressBar={showProgressBar}
                />
            ))}
        </div>
    );
}
