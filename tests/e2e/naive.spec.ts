import { expect, test } from "@playwright/test";
import { RENT_NOTICE } from "../../src/samples/letters";
import { fakeGeminiAnswer, interceptGoogle } from "./fixtures";

// Evidence for the claim on the page: with PREFER_ON_DEVICE and no on-device model
// (Playwright's Chromium has none), the SDK sends the raw letter to the cloud.
test("naive PREFER_ON_DEVICE sends the raw letter when the device model is unavailable; Plain Letter does not", async ({ page }) => {
  const calls = await interceptGoogle(page, () => ({ status: 200, json: fakeGeminiAnswer() }));
  await page.goto("/tests/fixtures/naive.html");
  await page.waitForFunction(() => (window as unknown as { naiveReady?: boolean }).naiveReady);
  const source = await page.evaluate(() => (window as unknown as { runNaive: () => Promise<string> }).runNaive());
  expect(source).toBe("in_cloud");
  expect(calls).toHaveLength(1);
  for (const s of RENT_NOTICE.sensitive) expect(calls[0]!.body).toContain(s);

  // Same letter through Plain Letter.
  await page.goto("/");
  await page.selectOption("#sample", "rent");
  await page.click("#read-btn");
  await page.click("#send-btn");
  await expect(page.getByTestId("source-pill")).toBeVisible();
  expect(calls).toHaveLength(2);
  for (const s of RENT_NOTICE.sensitive) expect(calls[1]!.body).not.toContain(s);
});
