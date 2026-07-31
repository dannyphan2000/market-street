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

import type { Meta, StoryObj } from '@storybook/react-vite';
import ShopperAgent from '../index';

/**
 * Docs-only: ShopperAgent renders no visible UI in Storybook. The chat surface is the
 * Salesforce Embedded Messaging (Agentforce) widget, a third-party script + iframe that does
 * not load here, so the wrapper renders nothing on the canvas. Behaviour (deferred idle-load,
 * load-on-demand, config validation, launch + queued-message sequencing) is covered by unit
 * tests in `index.test.tsx` and `shopper-agent.utils.test.ts`. The single `Docs` story below
 * only anchors the autodocs page (Storybook needs at least one story export); it is hidden from
 * the sidebar via the `!dev` tag and renders nothing, so there are no blank story entries.
 */
const meta: Meta<typeof ShopperAgent> = {
    title: 'Components/Shopper Agent',
    component: ShopperAgent,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: `
Shopper Agent integrates Salesforce Embedded Messaging (Agentforce) for commerce chat.
When configuration is invalid or disabled, the component renders nothing. In Storybook the embedded
script is not loaded, so the chat UI is never visible — this page documents the props only. The
component's behaviour is verified by unit tests (\`index.test.tsx\`, \`shopper-agent.utils.test.ts\`).
                `,
            },
        },
    },
    argTypes: {
        commerceAgentConfiguration: {
            description: 'Commerce agent configuration. If invalid, the component returns null.',
            control: false,
        },
        locale: { description: 'BCP-47 locale forwarded to Embedded Messaging.', control: 'text' },
        currency: { description: 'ISO currency forwarded as a prechat field.', control: 'text' },
        userId: { description: 'Shopper id forwarded as a prechat field.', control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof ShopperAgent>;

/**
 * Anchors the autodocs page only — Storybook requires at least one story export to generate a
 * Docs page. Hidden from the sidebar (`!dev`), so no blank story row appears.
 *
 * The render is a static placeholder rather than the real component: mounting `<ShopperAgent>`
 * with a valid config would try to load the (Storybook-absent) Embedded Messaging script, and an
 * invalid config logs a validation error — neither is useful documentation. The props table on
 * the Docs page comes from `component` + `argTypes`, so it stays complete without a live render.
 */
export const Docs: Story = {
    tags: ['!dev'],
    render: () => (
        <div className="rounded-none border border-border bg-muted p-4 text-sm text-muted-foreground">
            This component renders the Salesforce chat widget, which isn&rsquo;t visible in Storybook.
        </div>
    ),
};
