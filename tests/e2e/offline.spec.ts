import { expect, test } from "@playwright/test";
import { interceptGoogle } from "./fixtures";

test("offline with no on-device model: rule-based findings, and nothing leaves", async ({ page, context }) => {
  const calls = await interceptGoogle(page);
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1")) external.push(r.url());
  });
  await page.goto("/");
  await expect(page.locator("#device-pill")).toContainText("Private reader");
  await context.setOffline(true);
  await expect(page.locator("#net-pill")).toHaveText("Offline");
  await page.selectOption("#sample", "insurance-de");
  await page.click("#read-btn");
  await expect(page.locator("#answer")).toContainText("No model can read this letter right now");
  await expect(page.locator("#answer")).toContainText("17. November 2026");
  await expect(page.locator("#answer")).toContainText("64,20 EUR");
  await expect(page.locator(".run").first()).toContainText("Stayed on this device");
  expect(calls).toHaveLength(0);
  expect(external.filter((u) => u.includes("generateContent"))).toEqual([]);
});
