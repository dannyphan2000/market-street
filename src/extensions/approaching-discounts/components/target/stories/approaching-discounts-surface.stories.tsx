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
import ApproachingDiscountsSurface from '../approaching-discounts-surface';
import {
    discountSurfaceDecorator,
    emptyBasket,
    multipleDiscountsBasket,
    orderDiscountBasket,
} from './surface-target-story-utils';

const meta: Meta<typeof ApproachingDiscountsSurface> = {
    title: 'Extensions/Approaching Discounts/Surface',
    component: ApproachingDiscountsSurface,
    tags: ['autodocs', 'interaction'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Shared, surface-agnostic renderer. Reads the basket from context, selects the top approaching-discount, and delegates to the banner. Renders no banner when the basket has no displayable discount, but keeps a persistent (empty) aria-live region mounted so the first discount is announced as an update. The per-surface wrappers (cart, mini-cart, checkout) delegate here.',
            },
        },
    },
};

export default meta;
type Story = StoryObj<typeof ApproachingDiscountsSurface>;

export const ApproachingDiscount: Story = {
    decorators: [discountSurfaceDecorator(orderDiscountBasket)],
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        expect(within(canvasElement).getByTestId('approaching-discounts-banner')).toHaveAttribute(
            'data-state',
            'approaching'
        );
    },
};

export const NoDiscount: Story = {
    decorators: [discountSurfaceDecorator(emptyBasket)],
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        // Nothing to show — no banner renders, though the persistent aria-live region stays mounted.
        expect(within(canvasElement).queryByTestId('approaching-discounts-banner')).toBeNull();
    },
};

// By default the surface shows only the top discount even when the basket has several; raising
// `maxDiscounts` surfaces more, ordered approaching-first.
export const MultipleDiscounts: Story = {
    args: { maxDiscounts: 2 },
    decorators: [discountSurfaceDecorator(multipleDiscountsBasket)],
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        expect(within(canvasElement).getAllByTestId('approaching-discounts-banner')).toHaveLength(2);
    },
};

// `showMessage={false}` propagates to the banner: the progress bar renders but the message is
// visually hidden (kept for screen readers).
export const HiddenMessage: Story = {
    args: { showMessage: false },
    decorators: [discountSurfaceDecorator(orderDiscountBasket)],
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        expect(within(canvasElement).getByTestId('approaching-discounts-banner')).toHaveAttribute(
            'data-state',
            'approaching'
        );
    },
};

// `showProgressBar={false}` propagates to the banner: the message renders but the progress bar is
// visually hidden (kept for screen readers).
export const HiddenProgressBar: Story = {
    args: { showProgressBar: false },
    decorators: [discountSurfaceDecorator(orderDiscountBasket)],
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        expect(within(canvasElement).getByTestId('approaching-discounts-banner')).toHaveAttribute(
            'data-state',
            'approaching'
        );
    },
};
