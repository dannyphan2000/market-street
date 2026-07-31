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
import { ShopperAgentWindow } from '../shopper-agent-window';

/**
 * Docs-only: ShopperAgentWindow manages the Salesforce Embedded Messaging lifecycle (script
 * loading, init, prechat fields, conversation context, z-index) and renders null — it has no
 * visible UI of its own. There are no rendering stories because the component never paints
 * anything; the argTypes document the props.
 */
const meta: Meta<typeof ShopperAgentWindow> = {
    title: 'Components/Shopper Agent/Shopper Agent Window',
    component: ShopperAgentWindow,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: `
Internal component that manages the Salesforce Embedded Messaging window lifecycle (script loading,
init, prechat, conversation context). It renders null — no visible UI — and mounts the embedded
service. In Storybook the external script is not loaded, so there is nothing to render; this page
documents the props only.
                `,
            },
        },
    },
    argTypes: {
        config: {
            description: 'Commerce agent configuration object passed to Embedded Messaging.',
            control: false,
        },
        domainUrl: { description: 'Resolved storefront origin + locale prefix, sent to the iframe.', control: 'text' },
        locale: { description: 'BCP-47 locale (converted to Salesforce locale on init).', control: 'text' },
        currency: { description: 'ISO currency forwarded as a prechat field.', control: 'text' },
        siteId: { description: 'Commerce site id forwarded as a prechat field.', control: 'text' },
        userId: { description: 'Shopper id forwarded as a prechat field.', control: 'text' },
        usid: { description: 'Anonymous shopper id (usid) forwarded as a prechat field.', control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof ShopperAgentWindow>;

/**
 * Anchors the autodocs page only — Storybook requires at least one story export to generate a
 * Docs page. Hidden from the sidebar (`!dev`), so no blank story row appears. ShopperAgentWindow
 * renders null and manages the Embedded Messaging lifecycle, so a static placeholder stands in on
 * the Docs page. The props table comes from `component` + `argTypes`.
 */
export const Docs: Story = {
    tags: ['!dev'],
    render: () => (
        <div className="rounded-none border border-border bg-muted p-4 text-sm text-muted-foreground">
            This component renders the Salesforce chat widget, which isn&rsquo;t visible in Storybook.
        </div>
    ),
};
