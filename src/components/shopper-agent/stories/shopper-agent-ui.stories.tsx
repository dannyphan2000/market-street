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
import ShopperAgentUI from '../shopper-agent-ui';

/**
 * Docs-only: ShopperAgentUI validates config, computes the domain URL, and mounts
 * ShopperAgentWindow inside a wrapper div. The visible chat is the Salesforce Embedded
 * Messaging iframe, which does not load in Storybook, so the canvas shows only an empty
 * wrapper. There are no rendering stories because every prop combination paints the same
 * blank wrapper; the argTypes document the props.
 */
const meta: Meta<typeof ShopperAgentUI> = {
    title: 'Components/Shopper Agent/Shopper Agent UI',
    component: ShopperAgentUI,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: `
Shopper Agent UI chunk – loads the Embedded Messaging script and mounts the chat window.
When configuration is invalid, it renders null. In Storybook the embedded script is not loaded, so
only an empty wrapper is present — this page documents the props only.
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
        usid: { description: 'Anonymous shopper id (usid) forwarded as a prechat field.', control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof ShopperAgentUI>;

/**
 * Anchors the autodocs page only — Storybook requires at least one story export to generate a
 * Docs page. Hidden from the sidebar (`!dev`), so no blank story row appears. Renders a static
 * placeholder instead of mounting the component (which would either load the Storybook-absent
 * Embedded Messaging script or log a config-validation error). The props table comes from
 * `component` + `argTypes`.
 */
export const Docs: Story = {
    tags: ['!dev'],
    render: () => (
        <div className="rounded-none border border-border bg-muted p-4 text-sm text-muted-foreground">
            This component renders the Salesforce chat widget, which isn&rsquo;t visible in Storybook.
        </div>
    ),
};
