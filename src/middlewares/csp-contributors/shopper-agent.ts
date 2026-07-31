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

import type { CspContributor, CspContribution } from '@salesforce/storefront-next-runtime/security';
import type { AppConfig } from '@/types/config';
import { toCspOrigin } from './to-csp-origin.js';

// Single source of truth: derive from the resolved app config shape (already
// `| undefined` via the optional `commerceAgent?`) instead of hand-maintaining
// a parallel subset that could drift from the real config.
type CommerceAgentConfig = AppConfig['commerceAgent'];

const isEnabled = (e: string | boolean | undefined): boolean => e === true || e === 'true';

/** Collect valid, deduped CSP origins from a list of config URLs. */
function origins(...urls: (string | undefined)[]): string[] {
    const out: string[] = [];
    for (const u of urls) {
        const o = u ? toCspOrigin(u) : null;
        if (o && !out.includes(o)) out.push(o);
    }
    return out;
}

/**
 * CSP contributor for the shopper agent (Salesforce Embedded Messaging).
 * Boot-static: derives EXACT origins from the merchant's commerceAgent config.
 * Inactive (contributes nothing) when the agent is disabled or unconfigured.
 */
export function createShopperAgentCspContributor(config: CommerceAgentConfig): CspContributor {
    return {
        id: 'shopper-agent',
        isActive: () => isEnabled(config?.enabled),
        contribute: (): CspContribution => {
            if (!isEnabled(config?.enabled)) return {};

            // scriptSourceUrl → script-src (bootstrap script) + frame-src (iframe from same host)
            const scriptSrc = origins(config?.scriptSourceUrl);
            const frameSrc = origins(config?.scriptSourceUrl, config?.embeddedServiceEndpoint);

            // embeddedServiceEndpoint → frame-src + connect-src (API calls)
            // scrt2Url → connect-src (real-time messaging API)
            const connectSrc = origins(config?.scriptSourceUrl, config?.scrt2Url, config?.embeddedServiceEndpoint);

            // The Embedded Messaging bootstrap loads its own stylesheet
            // (bootstrap.min.css), fonts, and images from the script host. These
            // are the SAME origin already trusted in script-src, so adding it to
            // style/font/img-src grants no new host — just the fetch types the
            // widget actually uses. (style-src confirmed via runtime CSP error;
            // font/img added pre-emptively for the same host to avoid follow-on
            // violations once styles load.)
            const widgetAssets = origins(config?.scriptSourceUrl);

            const out: CspContribution = {};
            if (scriptSrc.length) out['script-src'] = scriptSrc;
            if (frameSrc.length) out['frame-src'] = frameSrc;
            if (connectSrc.length) out['connect-src'] = connectSrc;
            if (widgetAssets.length) {
                out['style-src'] = widgetAssets;
                out['font-src'] = widgetAssets;
                out['img-src'] = widgetAssets;
            }
            return out;
        },
    };
}
