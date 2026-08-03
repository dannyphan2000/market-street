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
import { type ReactElement, useId } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSite } from '@salesforce/storefront-next-runtime/site-context';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import type { ApproachingDiscountView } from '@/extensions/approaching-discounts/types/approaching-discounts';

export interface ApproachingDiscountsBannerProps {
    /** The single approaching-discount to display, pre-normalized by the surface wrapper. */
    discount: ApproachingDiscountView;
    /** Additional classes for the outer container (e.g. surface-specific spacing). */
    className?: string;
    /** Whether to show the message above the progress bar (default `true`) */
    showMessage?: boolean;
    /** Whether to show the progress bar (default `true`) */
    showProgressBar?: boolean;
}

/**
 * Progress bar showing how far the basket is toward the discount threshold.
 */
function DiscountProgressBar({
    discount,
    label,
    labelledById,
}: {
    discount: ApproachingDiscountView;
    label: string;
    labelledById?: string;
}): ReactElement {
    const { currency: siteCurrency } = useSite();
    const { t, i18n } = useTranslation('extApproachingDiscounts');

    const currency = discount.currency || siteCurrency;
    const hasRange = discount.threshold > 0;

    const min = formatCurrency(0, i18n.language, currency);
    const max = formatCurrency(discount.threshold, i18n.language, currency);
    const clampedNow = Math.min(discount.merchandiseTotal, discount.threshold);
    const current = formatCurrency(clampedNow, i18n.language, currency);

    return (
        <div className="w-full">
            {hasRange && (
                <div className="mb-1 flex justify-between text-sm text-muted-foreground">
                    <span>{min}</span>
                    <span className="font-semibold">{max}</span>
                </div>
            )}
            <div
                className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-labelledby={labelledById}
                aria-valuemin={0}
                aria-valuemax={hasRange ? discount.threshold : 1}
                aria-valuenow={hasRange ? clampedNow : 1}
                aria-valuetext={
                    hasRange
                        ? t('banner.progressLabel', {
                              merchandiseTotal: current,
                              threshold: max,
                              discount: label,
                          })
                        : label
                }>
                <div
                    className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${discount.progress * 100}%` }}
                />
            </div>
        </div>
    );
}

/**
 * ApproachingDiscountsBanner — a threshold-nudge banner for approaching promotions.
 * Renders one of two states: **approaching** or **achieved**.
 */
export default function ApproachingDiscountsBanner({
    discount,
    className,
    showMessage = true,
    showProgressBar = true,
}: ApproachingDiscountsBannerProps): ReactElement {
    const { currency: siteCurrency } = useSite();
    const { t, i18n } = useTranslation('extApproachingDiscounts');
    const messageId = useId();

    const currency = discount.currency || siteCurrency;
    const label = discount.label || t(`banner.fallbackDiscount.${discount.type}`);
    const formattedRemaining = formatCurrency(discount.amountRemaining, i18n.language, currency);

    return (
        <div
            className={cn('mb-4 space-y-2', className)}
            data-testid="approaching-discounts-banner"
            data-state={discount.achieved ? 'achieved' : 'approaching'}>
            <p id={messageId} className={cn('text-center text-sm text-foreground', !showMessage && 'sr-only')}>
                {discount.achieved ? (
                    <Trans
                        t={t}
                        i18nKey="banner.achieved"
                        values={{ discount: label }}
                        components={{ highlight: <span className="font-bold text-primary" /> }}
                    />
                ) : (
                    <Trans
                        t={t}
                        i18nKey="banner.approaching"
                        values={{ amount: formattedRemaining, discount: label }}
                        components={{
                            bold: <span className="font-semibold" />,
                            highlight: <span className="font-bold text-primary" />,
                        }}
                    />
                )}
            </p>
            <div className={cn(!showProgressBar && 'sr-only')}>
                <DiscountProgressBar discount={discount} label={label} labelledById={messageId} />
            </div>
        </div>
    );
}
