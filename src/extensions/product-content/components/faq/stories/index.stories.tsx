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
import { expect, within } from 'storybook/test';
import { waitForStorybookReady } from '@storybook/test-utils';
import { ConfigProvider } from '@salesforce/storefront-next-runtime/config';
import { SiteProvider } from '@salesforce/storefront-next-runtime/site-context';
import { mockAltSiteObject, mockBuildConfig, mockSiteObject } from '@/test-utils/config';
import Faq from '../index';

/** FAQ only mounts when shopper agent is enabled and passes validation (matches unit test fixtures). */
const faqStoryConfig = {
    ...mockBuildConfig.app,
    commerceAgent: {
        enabled: 'true' as const,
        embeddedServiceName: 'storybook_service',
        embeddedServiceEndpoint: 'https://test.my.site.com/ESWtest',
        scriptSourceUrl: 'https://test.my.site.com/ESWtest/assets/js/bootstrap.min.js',
        scrt2Url: 'https://test.salesforce-scrt.com',
        salesforceOrgId: '00Dxx0000000000',
        siteId: mockAltSiteObject.id,
    },
};

const DEFAULT_QUESTIONS = [
    'What sizes does this come in?',
    'Which color would work best for a minimalist space?',
    'Will this work in a minimalist living room?',
];

const LONG_QUESTIONS = [
    'I am furnishing a small studio apartment with limited natural light and a mostly cream and oak palette — would this piece work harmoniously, or would the contrast feel too stark?',
    'How does the construction handle long-term daily use, particularly in households with pets and kids who tend to be rougher on furniture than the average customer?',
    'Is there a recommended care routine for keeping the surface looking new across changing seasons in a coastal humid climate?',
];

type FaqStoryArgs = {
    questions: string[];
};

const meta: Meta<FaqStoryArgs> = {
    title: 'Extensions/ProductContent/Faq',
    component: Faq,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'PDP-level FAQ section that surfaces shopper-agent suggested questions. Mounts only when (a) the commerce agent is enabled and validates, and (b) the shopper-agent context UI flag is on, and (c) at least one question is supplied. Page-level coverage (per WI Step 5) — story renders the full collapsible section with the AI badge, not just the question rows.',
            },
        },
    },
    argTypes: {
        questions: {
            description:
                'Questions resolved from the route loader. Empty array → component returns null (renders nothing).',
            control: 'object',
        },
    },
    args: {
        questions: DEFAULT_QUESTIONS,
    },
    // composeStories runs outside the global decorator stack; Faq calls useConfig() and useSite()
    // so we declare the providers on the meta to satisfy both the storybook UI and any snapshot path.
    decorators: [
        (Story) => (
            <ConfigProvider config={faqStoryConfig}>
                <SiteProvider
                    site={faqStoryConfig.commerce.sites[0]}
                    locale={faqStoryConfig.commerce.sites[0].supportedLocales[0]}
                    language={mockSiteObject.defaultLocale}
                    currency={mockSiteObject.defaultCurrency}>
                    <div className="max-w-md p-6">
                        <Story />
                    </div>
                </SiteProvider>
            </ConfigProvider>
        ),
    ],
};

export default meta;
type Story = StoryObj<FaqStoryArgs>;

export const Playground: Story = {
    parameters: {
        docs: {
            description: {
                story: 'Edit the questions array directly to explore every authoring shape.',
            },
        },
    },
};

export const Default: Story = {
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        await expect(await canvas.findByText(/ask assistant/i)).toBeInTheDocument();
        await expect(canvas.getByText('AI')).toBeInTheDocument();
        for (const q of DEFAULT_QUESTIONS) {
            await expect(canvas.getByText(q)).toBeInTheDocument();
        }
    },
};

export const EmptyQuestions: Story = {
    args: {
        questions: [],
    },
    parameters: {
        docs: {
            description: {
                story: 'When the loader resolves with no questions (or no shopper-agent context), the component returns null — nothing renders on the page. Coverage for the merchant-facing "no FAQ available" state.',
            },
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        // Component returned null — no Ask Assistant heading, no AI badge.
        await expect(canvas.queryByText(/ask assistant/i)).not.toBeInTheDocument();
        await expect(canvas.queryByText('AI')).not.toBeInTheDocument();
    },
};

export const LongCopy: Story = {
    args: {
        questions: LONG_QUESTIONS,
    },
    parameters: {
        docs: {
            description: {
                story: 'AC #2 long-copy authoring — verifies the question-row layout (sparkle icon + question text + chevron) handles multi-sentence questions without breaking the truncation/wrap behavior.',
            },
        },
    },
    play: async ({ canvasElement }) => {
        await waitForStorybookReady(canvasElement);
        const canvas = within(canvasElement);

        await expect(await canvas.findByText(/ask assistant/i)).toBeInTheDocument();
        await expect(canvas.getByText(LONG_QUESTIONS[0])).toBeInTheDocument();
    },
};
