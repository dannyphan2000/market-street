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
/** @sfdc-extension-file SFDC_EXT_PRODUCT_CONTENT */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within, userEvent, fn } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import FaqQuestionItem from '../faq-question-item';

const meta: Meta<typeof FaqQuestionItem> = {
    title: 'Extensions/ProductContent/Faq/FaqQuestionItem',
    component: FaqQuestionItem,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'A single clickable FAQ question row with sparkle icon + question text + chevron. The whole box is a button; clicking forwards the question text to the parent `onClick` handler (in production: opens the shopper agent with the question prefilled).',
            },
        },
    },
    argTypes: {
        question: { control: 'text' },
        ariaLabel: { control: 'text' },
        onClick: { action: 'clicked' },
        className: { table: { disable: true } },
    },
    args: {
        question: 'What sizes does this come in?',
        ariaLabel: 'Send question to assistant: What sizes does this come in?',
    },
};

export default meta;
type Story = StoryObj<typeof FaqQuestionItem>;

export const Playground: Story = {
    parameters: {
        docs: {
            description: {
                story: 'Edit the question and aria-label via Controls; click the row to fire the `onClick` action.',
            },
        },
    },
};

export const Default: Story = {
    play: async ({ canvasElement, args }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        const button = await canvas.findByRole('button');
        await expect(button).toBeInTheDocument();
        await expect(canvas.getByText(args.question)).toBeInTheDocument();
        // The sparkle icon and chevron are decorative (aria-hidden); only the text is announced.
        await expect(button).toHaveAccessibleName(args.ariaLabel ?? '');
    },
};

export const LongQuestion: Story = {
    args: {
        question:
            'I am furnishing a small studio apartment with limited natural light and a mostly cream and oak palette — would this piece work harmoniously with my existing aesthetic, or would the contrast feel too stark for a calm reading nook?',
        ariaLabel: 'Send long question to assistant',
    },
    parameters: {
        docs: {
            description: {
                story: 'AC #2 long-copy authoring — verifies the question text wraps inside the row without breaking the icon + text + chevron layout (the row uses `min-w-0 flex-1` on the text span).',
            },
        },
    },
};

export const ClickFiresOnClick: Story = {
    args: {
        // Spy so the play function can assert the handler actually fired with the
        // question text — `toHaveFocus()` alone would pass even if onClick never ran.
        onClick: fn(),
    },
    parameters: {
        docs: {
            description: {
                story: 'Verifies clicking the row fires `onClick(question)` — the real coupled behavior the component exists for.',
            },
        },
    },
    play: async ({ canvasElement, args }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        const button = await canvas.findByRole('button');
        await userEvent.click(button);
        // The component calls `onClick?.(question)` (faq-question-item.tsx:46) — assert the
        // spy received exactly the question text, so a regression in that wiring is caught.
        await expect(args.onClick).toHaveBeenCalledWith(args.question);
    },
};
