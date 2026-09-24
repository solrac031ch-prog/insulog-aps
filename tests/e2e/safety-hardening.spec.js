"use strict";
const { test, expect } = require("@playwright/test");

// This file also serves as the explicit CI trigger after fail-safe hardening changes.
test("autotest fail-safe is healthy on normal load", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#insulog-safety-lock")).toHaveCount(0);
  const status = await page.evaluate(() => ({
    guard: Boolean(window.InsulogSafetyGuard), locked: window.InsulogSafetyGuard?.isLocked(),
    engineVersion: window.InsulogClinicalEngine?.version, appVersion: window.InsulogApp?.clinicalVersion
  }));
  expect(status.guard).toBe(true);
  expect(status.locked).toBe(false);
  expect(status.engineVersion).toBe("APS-NPH-2026.09.24-r6");
  expect(status.appVersion).toBe(status.engineVersion);
});

test("critical action error fails closed", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.InsulogSafetyGuard.reportActionError("calculate-followup", new Error("forced test")));
  await expect(page.locator("#insulog-safety-lock")).toBeVisible();
  await expect(page.locator('[data-action="calculate-followup"]')).toBeDisabled();
  await expect(page.locator('[data-action="calculate-initial"]')).toBeDisabled();
});
