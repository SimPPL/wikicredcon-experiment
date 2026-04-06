import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001';

test('Full flow with real Arbiter claims', async ({ page }) => {
  test.setTimeout(60000);

  // Clear state, pre-consent, force treatment + PFAS article
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('wikicred_consent', JSON.stringify({ consentedAt: Date.now(), version: '1.0' }));
    localStorage.setItem('wikicred_participant_count', '0');
    // Force PFAS as the article (has 9 real Arbiter claims)
    localStorage.setItem('wikicred_selected_articles', JSON.stringify(['pfas', 'openai']));
  });
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Register
  await page.fill('input[type="email"]', 'claims-test@example.com');
  await page.selectOption('select >> nth=0', '3-5 years');
  await page.selectOption('select >> nth=1', '500-5,000');
  await page.click('input[name="frequency"][value="sometimes"]');
  await page.click('input[name="confidence"][value="4"]');
  await page.click('input[name="usefulness"][value="3"]');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/edit', { timeout: 15000 });

  // Wait for article to load
  await page.waitForSelector('.wiki-article', { timeout: 15000 });
  const title = await page.locator('.wiki-article h1').first().textContent();
  console.log('Article title:', title);

  // Check sidebar is visible (treatment condition)
  const sidebar = page.locator('.arbiter-sidebar');
  const sidebarVisible = await sidebar.isVisible();
  console.log('Sidebar visible:', sidebarVisible);

  if (sidebarVisible) {
    // Check sidebar has the warning text
    const sidebarText = await sidebar.innerText();
    console.log('Has warning about accuracy:', sidebarText.includes('need not be accurate'));
    console.log('Has claims count:', sidebarText.includes('claims tracked'));

    await page.screenshot({ path: 'tests/screenshots/real-claims-01-sidebar.png', fullPage: true });

    // Click [edit] on a section to see section-specific claims
    const editLinks = page.locator('.wiki-edit-link');
    const linkCount = await editLinks.count();
    console.log('[edit] links:', linkCount);

    if (linkCount > 1) {
      await editLinks.nth(1).scrollIntoViewIfNeeded();
      await editLinks.nth(1).click();
      await page.waitForTimeout(500);

      // Check if claims appeared for this section
      const updatedSidebar = await sidebar.innerText();
      console.log('Sidebar after edit click (first 300):', updatedSidebar.slice(0, 300));
      console.log('Shows "Claims related to":', updatedSidebar.includes('Claims related to'));

      await page.screenshot({ path: 'tests/screenshots/real-claims-02-section-claims.png', fullPage: true });
    }
  } else {
    console.log('No sidebar — checking if collapsed...');
    const arbiterBtn = page.locator('button:has-text("Arbiter")');
    if (await arbiterBtn.isVisible()) {
      await arbiterBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/real-claims-01-expanded.png', fullPage: true });
    }
  }

  // Verify claims data is real Arbiter data (not placeholder)
  const claimsResponse = await page.evaluate(async () => {
    // Try loading the claims file directly
    const resp = await fetch('/data/claims/pfas.json');
    if (resp.ok) {
      const claims = await resp.json();
      return {
        count: claims.length,
        firstClaim: claims[0]?.claimText?.slice(0, 80),
        firstAuthor: claims[0]?.sourceAuthor,
        firstPlatform: claims[0]?.platform,
        hasEngagement: claims[0]?.engagement?.total > 0,
      };
    }
    return null;
  });

  console.log('\nClaims data check:');
  console.log('  Claims count:', claimsResponse?.count);
  console.log('  First claim:', claimsResponse?.firstClaim);
  console.log('  Author:', claimsResponse?.firstAuthor);
  console.log('  Platform:', claimsResponse?.firstPlatform);
  console.log('  Has engagement:', claimsResponse?.hasEngagement);

  expect(claimsResponse?.count).toBeGreaterThan(0);
  expect(claimsResponse?.hasEngagement).toBe(true);

  console.log('\n=== REAL CLAIMS TEST PASSED ===');
});
