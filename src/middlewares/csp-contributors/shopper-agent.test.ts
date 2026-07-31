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

import { describe, it, expect } from 'vitest';
import { createShopperAgentCspContributor } from './shopper-agent';

const cfg = {
    enabled: 'true',
    embeddedServiceName: 'Demo_Agent',
    scriptSourceUrl: 'https://demo.my.site.com/path/bootstrap.js',
    scrt2Url: 'https://demo.my.salesforce-scrt.com',
    embeddedServiceEndpoint: 'https://demo.my.site.com/endpoint',
    salesforceOrgId: '00Dxx0000000000',
    siteId: 'RefArch',
} as const;

describe('shopper-agent CSP contributor', () => {
    it('is inactive when commerceAgent is absent or disabled', () => {
        expect(createShopperAgentCspContributor(undefined).isActive({ baseDirectives: {} })).toBe(false);
        expect(createShopperAgentCspContributor({ ...cfg, enabled: 'false' }).isActive({ baseDirectives: {} })).toBe(
            false
        );
    });

    it('is active when enabled (string "true" or boolean true)', () => {
        expect(createShopperAgentCspContributor(cfg).isActive({ baseDirectives: {} })).toBe(true);
        expect(createShopperAgentCspContributor({ ...cfg, enabled: true }).isActive({ baseDirectives: {} })).toBe(true);
    });

    it('contributes exact origins, deduped, with path stripped', () => {
        const c = createShopperAgentCspContributor(cfg).contribute({ baseDirectives: {} });
        expect(c['script-src']).toEqual(['https://demo.my.site.com']);
        expect(c['frame-src']).toEqual(['https://demo.my.site.com']);
        expect(c['connect-src']).toEqual(['https://demo.my.site.com', 'https://demo.my.salesforce-scrt.com']);
        // The bootstrap loads its stylesheet/fonts/images from the script host.
        expect(c['style-src']).toEqual(['https://demo.my.site.com']);
        expect(c['font-src']).toEqual(['https://demo.my.site.com']);
        expect(c['img-src']).toEqual(['https://demo.my.site.com']);
        // no path leaked into any emitted origin
        expect(JSON.stringify(c)).not.toContain('/path');
        expect(JSON.stringify(c)).not.toContain('/endpoint');
    });

    it('returns empty contribution when disabled', () => {
        expect(
            createShopperAgentCspContributor({ ...cfg, enabled: 'false' }).contribute({ baseDirectives: {} })
        ).toEqual({});
    });

    it('skips malformed URLs without throwing', () => {
        const c = createShopperAgentCspContributor({ ...cfg, scrt2Url: 'not-a-url' }).contribute({
            baseDirectives: {},
        });
        expect(JSON.stringify(c)).not.toContain('not-a-url');
    });

    it('deduplicates origins across directives', () => {
        // Both scriptSourceUrl and embeddedServiceEndpoint point to the same host
        const c = createShopperAgentCspContributor(cfg).contribute({ baseDirectives: {} });

        // frame-src should dedupe https://demo.my.site.com (from both scriptSourceUrl and embeddedServiceEndpoint)
        const frameSrcOrigins = c['frame-src'] || [];
        const siteComCount = frameSrcOrigins.filter((o) => o === 'https://demo.my.site.com').length;
        expect(siteComCount).toBe(1); // Only appears once despite two sources
    });
});
