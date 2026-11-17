import { expect, test } from "@playwright/test";

// Demo mode drives the on-device states that Playwright's Chromium cannot produce.
test("on-device path: read here, ledger says nothing left", async ({ page }) => {
  await page.goto("/?ai=demo&fakeDevice=available");
  await expect(page.locator("#device-pill")).toHaveText("Private reader: ready");
  await page.selectOption("#sample", "rent");
  await page.click("#read-btn");
  await expect(page.getByTestId("source-pill")).toHaveText("Read on this device");
  await expect(page.locator(".run").first()).toContainText("Nothing was sent");
});

test("model not downloaded: the prepare control downloads with progress, then reads on device", async ({ page }) => {
  await page.goto("/?ai=demo&fakeDevice=downloadable&fakeDelay=200");
  await expect(page.locator("#device-pill")).toHaveText("Private reader: not downloaded");
  await page.locator(".pane--letter").getByRole("button", { name: "Prepare the private reader" }).click();
  await expect(page.locator("#device-pill")).toHaveText("Private reader: ready", { timeout: 10_000 });
  await page.selectOption("#sample", "school");
  await page.click("#read-btn");
  await expect(page.getByTestId("source-pill")).toHaveText("Read on this device");
});

test("a reader language the device cannot write goes to review, not to the cloud", async ({ page }) => {
  await page.goto("/?ai=demo&fakeDevice=available");
  await page.selectOption("#lang", "ko");
  await page.selectOption("#sample", "rent");
  await page.click("#read-btn");
  await expect(page.locator(".reasons")).toContainText("cannot write Korean");
  await expect(page.getByTestId("masked-preview")).toBeVisible();
});

test("photo without an on-device model asks for text and uploads nothing", async ({ page }) => {
  await page.goto("/?ai=demo&fakeDevice=no-api");
  await page.check("#kind-photo", { force: true });
  await page.setInputFiles("#photo", { name: "letter.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await expect(page.locator("#photo-help")).toContainText("never uploaded");
});

test("empty submit explains what to do", async ({ page }) => {
  await page.goto("/?ai=demo");
  await page.click("#read-btn");
  await expect(page.locator("#letter-help")).toHaveText("Paste a letter first, or choose a sample.");
  await expect(page.locator("#letter")).toBeFocused();
});
