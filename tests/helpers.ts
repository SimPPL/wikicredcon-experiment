import type { Page } from '@playwright/test';

/**
 * The edit page opens behind an instruction stepper. Older specs were written
 * before it existed and click straight into the article, where the modal
 * swallows the click. Call this after landing on /edit.
 */
export async function dismissInstructions(page: Page) {
  // The stepper mounts a beat after the route resolves, so give it a moment to
  // appear before deciding there is nothing to dismiss.
  const anyStep = page.locator(
    'button:has-text("Next"), button:has-text("Start editing"), button:has-text("Got it"), button:has-text("Begin")'
  );
  await anyStep.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

  for (let i = 0; i < 10; i++) {
    const next = page.locator(
      'button:has-text("Next"), button:has-text("Start editing"), button:has-text("Got it"), button:has-text("Begin")'
    );
    if (await next.count() === 0) break;
    if (!(await next.first().isVisible().catch(() => false))) break;
    await next.first().click();
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(200);
}

/** Landing hero -> consent -> signup form. Stops once the email field shows. */
export async function reachSignupForm(page: Page) {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('input[type="email"]').count()) > 0) return;
    const checks = page.locator('input[type="checkbox"]');
    for (let c = 0; c < (await checks.count()); c++) {
      await checks.nth(c).check({ force: true }).catch(() => {});
    }
    const advance = page.locator(
      'button:has-text("Start Editing"), button:has-text("I consent"), button:has-text("I agree"), button:has-text("Continue"), button:has-text("Next")'
    );
    if ((await advance.count()) === 0) return;
    await advance.first().click();
    await page.waitForTimeout(600);
  }
}
