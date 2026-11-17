import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function serious(page: import("@playwright/test").Page) {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("no serious axe violations: start, review, result", async ({ page }) => {
  await page.goto("/?ai=demo&fakeDevice=no-api");
  expect(await serious(page)).toEqual([]);
  await page.click("#recording-btn");
  expect(await serious(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await page.selectOption("#sample", "rent");
  await page.click("#read-btn");
  await page.getByTestId("masked-preview").waitFor();
  expect(await serious(page)).toEqual([]);
  await page.click("#send-btn");
  await page.getByTestId("source-pill").waitFor();
  expect(await serious(page)).toEqual([]);
});

test("keyboard only: sample, read, send", async ({ page }) => {
  await page.goto("/?ai=demo&fakeDevice=no-api");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip")).toBeFocused();
  await page.focus("#letter");
  await page.keyboard.type("Dear Ms Okafor, your rent rises to $1,595.00 from May 1, 2026. Write to us by April 1, 2026 if you will move out.");
  // Tab from the text area to the sample picker, the language picker, the recording link, then the read button.
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  await expect(page.locator("#read-btn")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#send-btn")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("source-pill")).toBeVisible();
});
