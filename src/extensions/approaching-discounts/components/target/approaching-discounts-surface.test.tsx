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
import { render, screen } from '@testing-library/react';
import type { ShopperBasketsV2 } from '@/scapi';
import ApproachingDiscountsSurface from './approaching-discounts-surface';
import type { ApproachingDiscountView } from '@/extensions/approaching-discounts/types/approaching-discounts';

vi.mock('@/providers/basket', () => ({
    useBasket: vi.fn(),
}));

// Stub the banner so this test isolates the surface's select-or-null wiring.
vi.mock('@/extensions/approaching-discounts/components/approaching-discounts-banner', () => ({
    default: ({
        discount,
        showMessage,
        showProgressBar,
    }: {
        discount: ApproachingDiscountView;
        showMessage?: boolean;
        showProgressBar?: boolean;
    }) => (
        <div
            data-testid="banner-stub"
            data-discount-id={discount.id}
            data-achieved={String(discount.achieved)}
            data-show-message={String(showMessage)}
            data-show-progress-bar={String(showProgressBar)}
        />
    ),
}));

type Basket = ShopperBasketsV2.schemas['Basket'];

const approachingDiscount: ShopperBasketsV2.schemas['ApproachingDiscount'] = {
    type: 'order',
    conditionThreshold: 100,
    merchandiseTotal: 60,
    promotionLink: { promotionId: 'promo-1', name: '10% off $100 orders' },
};

describe('ApproachingDiscountsSurface', () => {
    let mockUseBasket: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { useBasket } = await import('@/providers/basket');
        mockUseBasket = useBasket as unknown as ReturnType<typeof vi.fn>;
    });

    it('renders the banner with the top approaching discount', () => {
        mockUseBasket.mockReturnValue({ approachingDiscounts: [approachingDiscount] } as Basket);

        render(<ApproachingDiscountsSurface />);

        const stub = screen.getByTestId('banner-stub');
        expect(stub).toHaveAttribute('data-discount-id', 'promo-1');
        expect(stub).toHaveAttribute('data-achieved', 'false');
    });

    it('renders no banner when the basket is undefined', () => {
        mockUseBasket.mockReturnValue(undefined);

        render(<ApproachingDiscountsSurface />);

        expect(screen.queryByTestId('banner-stub')).not.toBeInTheDocument();
    });

    it('renders no banner when the basket has no approaching discounts', () => {
        mockUseBasket.mockReturnValue({ approachingDiscounts: [] } as unknown as Basket);

        render(<ApproachingDiscountsSurface />);

        expect(screen.queryByTestId('banner-stub')).not.toBeInTheDocument();
    });

    it('renders no banner when every approaching discount is invalid', () => {
        mockUseBasket.mockReturnValue({
            approachingDiscounts: [{ type: 'order', conditionThreshold: 0 }],
        } as unknown as Basket);

        render(<ApproachingDiscountsSurface />);

        expect(screen.queryByTestId('banner-stub')).not.toBeInTheDocument();
    });

    // The aria-live region must persist even when empty so the first discount is announced as an
    // update to an existing region rather than a fresh (unannounced) mount.
    it('keeps an empty aria-live region mounted when there is nothing to show', () => {
        mockUseBasket.mockReturnValue(undefined);

        const { container } = render(<ApproachingDiscountsSurface />);

        const region = container.querySelector('[aria-live="polite"]');
        expect(region).toBeInTheDocument();
        expect(region).toBeEmptyDOMElement();
    });

    // Once every threshold is met, the surface falls back to the achieved promotion so the
    // shopper sees the "Success!" confirmation (SCAPI has dropped it from approachingDiscounts).
    it('renders the achieved banner when the only promotion is already achieved', () => {
        mockUseBasket.mockReturnValue({
            approachingDiscounts: null,
            orderPriceAdjustments: [{ promotionId: 'promo-1', itemText: 'Test approaching order discount' }],
        } as unknown as Basket);

        render(<ApproachingDiscountsSurface />);

        const stub = screen.getByTestId('banner-stub');
        expect(stub).toHaveAttribute('data-discount-id', 'promo-1');
        expect(stub).toHaveAttribute('data-achieved', 'true');
    });

    // An approaching promotion is a stronger nudge than an achieved one, so approaching wins the
    // single banner slot when both are present.
    it('prefers a still-approaching promotion over an achieved one', () => {
        mockUseBasket.mockReturnValue({
            approachingDiscounts: [{ ...approachingDiscount, promotionLink: { promotionId: 'promo-2' } }],
            orderPriceAdjustments: [{ promotionId: 'achieved-promo', itemText: 'Already earned' }],
        } as unknown as Basket);

        render(<ApproachingDiscountsSurface />);

        const stub = screen.getByTestId('banner-stub');
        expect(stub).toHaveAttribute('data-discount-id', 'promo-2');
        expect(stub).toHaveAttribute('data-achieved', 'false');
    });

    // AC9: skips an achieved promotion and surfaces the next still-approaching one.
    it('surfaces the first still-approaching promotion, skipping achieved ones', () => {
        mockUseBasket.mockReturnValue({
            approachingDiscounts: [
                { ...approachingDiscount, promotionLink: { promotionId: 'achieved-promo' } },
                { ...approachingDiscount, promotionLink: { promotionId: 'promo-2' } },
            ],
            orderPriceAdjustments: [{ promotionId: 'achieved-promo' }],
        } as unknown as Basket);

        render(<ApproachingDiscountsSurface />);

        expect(screen.getByTestId('banner-stub')).toHaveAttribute('data-discount-id', 'promo-2');
    });

    it('shows the message by default (showMessage defaults to true)', () => {
        mockUseBasket.mockReturnValue({ approachingDiscounts: [approachingDiscount] } as Basket);

        render(<ApproachingDiscountsSurface />);

        expect(screen.getByTestId('banner-stub')).toHaveAttribute('data-show-message', 'true');
    });

    it('propagates showMessage=false down to the banner', () => {
        mockUseBasket.mockReturnValue({ approachingDiscounts: [approachingDiscount] } as Basket);

        render(<ApproachingDiscountsSurface showMessage={false} />);

        expect(screen.getByTestId('banner-stub')).toHaveAttribute('data-show-message', 'false');
    });

    it('shows the progress bar by default (showProgressBar defaults to true)', () => {
        mockUseBasket.mockReturnValue({ approachingDiscounts: [approachingDiscount] } as Basket);

        render(<ApproachingDiscountsSurface />);

        expect(screen.getByTestId('banner-stub')).toHaveAttribute('data-show-progress-bar', 'true');
    });

    it('propagates showProgressBar=false down to the banner', () => {
        mockUseBasket.mockReturnValue({ approachingDiscounts: [approachingDiscount] } as Basket);

        render(<ApproachingDiscountsSurface showProgressBar={false} />);

        expect(screen.getByTestId('banner-stub')).toHaveAttribute('data-show-progress-bar', 'false');
    });

    it('reads the basket without opting in to auto-load (checkout hydrates the basket)', () => {
        mockUseBasket.mockReturnValue({ approachingDiscounts: [approachingDiscount] } as Basket);

        render(<ApproachingDiscountsSurface />);

        expect(mockUseBasket).toHaveBeenCalled();
        const args = mockUseBasket.mock.calls[0];
        expect(args[0]?.autoLoad).not.toBe(true);
    });

    describe('maxDiscounts', () => {
        const twoApproaching = {
            approachingDiscounts: [
                { ...approachingDiscount, promotionLink: { promotionId: 'promo-1' } },
                { ...approachingDiscount, promotionLink: { promotionId: 'promo-2' } },
            ],
        } as unknown as Basket;

        it('shows only the top discount by default', () => {
            mockUseBasket.mockReturnValue(twoApproaching);

            render(<ApproachingDiscountsSurface />);

            const stubs = screen.getAllByTestId('banner-stub');
            expect(stubs).toHaveLength(1);
            expect(stubs[0]).toHaveAttribute('data-discount-id', 'promo-1');
        });

        it('renders multiple banners in priority order when maxDiscounts is raised', () => {
            mockUseBasket.mockReturnValue(twoApproaching);

            render(<ApproachingDiscountsSurface maxDiscounts={2} />);

            const stubs = screen.getAllByTestId('banner-stub');
            expect(stubs).toHaveLength(2);
            expect(stubs.map((s) => s.getAttribute('data-discount-id'))).toEqual(['promo-1', 'promo-2']);
        });

        it('clamps to the number of discounts actually available', () => {
            mockUseBasket.mockReturnValue({ approachingDiscounts: [approachingDiscount] } as Basket);

            render(<ApproachingDiscountsSurface maxDiscounts={5} />);

            expect(screen.getAllByTestId('banner-stub')).toHaveLength(1);
        });

        it('orders approaching discounts before achieved ones across the limit', () => {
            mockUseBasket.mockReturnValue({
                approachingDiscounts: [{ ...approachingDiscount, promotionLink: { promotionId: 'approaching-1' } }],
                orderPriceAdjustments: [{ promotionId: 'achieved-1', itemText: 'Already earned' }],
            } as unknown as Basket);

            render(<ApproachingDiscountsSurface maxDiscounts={2} />);

            const stubs = screen.getAllByTestId('banner-stub');
            expect(stubs).toHaveLength(2);
            expect(stubs[0]).toHaveAttribute('data-discount-id', 'approaching-1');
            expect(stubs[0]).toHaveAttribute('data-achieved', 'false');
            expect(stubs[1]).toHaveAttribute('data-discount-id', 'achieved-1');
            expect(stubs[1]).toHaveAttribute('data-achieved', 'true');
        });

        it('renders no banner when maxDiscounts is below 1', () => {
            mockUseBasket.mockReturnValue(twoApproaching);

            render(<ApproachingDiscountsSurface maxDiscounts={0} />);

            expect(screen.queryByTestId('banner-stub')).not.toBeInTheDocument();
        });
    });
});
