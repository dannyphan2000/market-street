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

Feature('Storefront Core Tests').tag('@core');

const { storefrontPage } = inject();
import { expect } from 'chai';

Scenario('Homepage loads and sets SFCC cookies', async () => {
    // Navigate to the storefront homepage
    storefrontPage.navigate();

    // Verify page has loaded (waits for nav), then check title.
    // Assert on the brand-agnostic 'Storefront Next:' prefix rather than a
    // specific store name: this spec ships flattened into every vertical mirror
    // (fashion → "Market Street", cosmetic → "Dazzle") and into customer
    // projects that rebrand the store. Coupling to one brand would break the
    // others.
    storefrontPage.validatePageLoaded();
    storefrontPage.validateTitle('Storefront Next:');

    // The prefix substring alone passes even on an empty/fallback title
    // ("Storefront Next: " with nothing after the colon). Grab the full title
    // and assert a non-whitespace brand suffix to confirm the site name actually
    // resolved — still brand-agnostic (matches "Market Street", "Dazzle", or any
    // rebrand), but no longer satisfied by a bare prefix.
    const title = await storefrontPage.getTitle();
    expect(title, 'Homepage title should resolve a non-empty store name after the prefix').to.match(
        /Storefront Next:\s*\S+/
    );

    // Validate that SFCC cookies are properly set (storefront domain only)
    await storefrontPage.validateSFCCCookies();
})
    .tag('@homepage')
    .tag('@cookies')
    .tag('@smoke');

Scenario('Homepage displays product tiles', async () => {
    // Navigate to the storefront homepage
    storefrontPage.navigate();

    // Verify page has loaded successfully
    storefrontPage.validatePageLoaded();

    // Check that product tiles are displayed
    const productCount = await storefrontPage.getProductCount();

    // Verify we have at least some products displayed
    expect(productCount, 'Should have product tiles on homepage').to.be.greaterThan(0);
})
    .tag('@homepage')
    .tag('@products')
    .tag('@smoke');
