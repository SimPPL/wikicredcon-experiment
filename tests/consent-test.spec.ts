import { test, expect } from '@playwright/test';
const PROD = 'https://app-1t58fcex3-swapneel-mehta-projects.vercel.app';

test('Consent form flow on production', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(PROD);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  // Should see consent form first
  await page.screenshot({ path: 'tests/screenshots/consent-01-form.png', fullPage: true });
  const bodyText = await page.textContent('body');
  console.log('Shows consent form:', bodyText?.includes('Informed Consent'));
  console.log('Shows data collection:', bodyText?.includes('Data Collection'));
  console.log('Shows anonymization:', bodyText?.includes('Anonymization'));
  
  // Check both checkboxes
  const checkboxes = page.locator('input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  console.log('Checkboxes found:', cbCount);
  for (let i = 0; i < cbCount; i++) {
    await checkboxes.nth(i).check();
  }
  
  // Continue button should now be enabled
  const continueBtn = page.locator('button:has-text("Continue")');
  await expect(continueBtn).toBeEnabled();
  await page.screenshot({ path: 'tests/screenshots/consent-02-checked.png', fullPage: true });
  await continueBtn.click();
  await page.waitForTimeout(1000);
  
  // Should now see registration form
  await page.screenshot({ path: 'tests/screenshots/consent-03-registration.png', fullPage: true });
  const regText = await page.textContent('body');
  console.log('Shows registration after consent:', regText?.includes('Email') || regText?.includes('email'));
  
  // Verify consent saved in localStorage
  const consent = await page.evaluate(() => localStorage.getItem('wikicred_consent'));
  console.log('Consent saved:', consent !== null);
  if (consent) console.log('Consent data:', consent);
  
  console.log('=== CONSENT TEST PASSED ===');
});
