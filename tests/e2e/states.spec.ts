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

test("photo without an on-device model: read locally without AI, and the photo is never uploaded", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1") && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) outside.push(r.url());
  });
  await page.goto("/?ai=demo&fakeDevice=no-api");
  await page.check("#kind-photo", { force: true });
  await page.setInputFiles("#photo", "tests/e2e/assets/rent-letter.png");
  await expect(page.locator("#photo-help")).toContainText("will not be uploaded");
  await page.click("#ocr-btn");
  await expect(page.locator("#letter")).toHaveValue(/April 1, 2026/, { timeout: 30_000 });
  await expect(page.locator("#letter")).toHaveValue(/Okafor/);
  expect(outside).toEqual([]);
});

test("empty submit explains what to do", async ({ page }) => {
  await page.goto("/?ai=demo");
  await page.click("#read-btn");
  await expect(page.locator("#letter-help")).toHaveText("Paste a letter first, or choose a sample.");
  await expect(page.locator("#letter")).toBeFocused();
});

test("a weak on-device answer is never shown: it goes to the masked review instead", async ({ page }) => {
  await page.goto("/?ai=demo&fakeDevice=available&fakeDeviceAnswer=wrong-language&lang=es");
  await page.selectOption("#sample", "rent");
  await page.click("#read-btn");
  await expect(page.getByTestId("masked-preview")).toBeVisible();
  await expect(page.locator(".reasons")).toContainText("answered in the wrong language");
  await expect(page.locator(".run", { hasText: "on-device answer not used" })).toContainText("Stayed on this device");
  await expect(page.locator(".run").first()).toContainText("Not sent yet");
});

test("before Read, the page says which path this browser will take", async ({ page }) => {
  await page.goto("/?ai=demo&fakeDevice=available&lang=es");
  await expect(page.locator("#path-text")).toContainText("will be read on this device");
  await page.selectOption("#sample", "benefit");
  await expect(page.locator("#path-text")).toContainText("too long for the on-device model");
  await expect(page.locator("#path-text")).toContainText("Nothing is sent until you approve it");
});

test("no on-device model: the preview says so, and the recorded run is labelled as a recording", async ({ page }) => {
  await page.goto("/?ai=demo&fakeDevice=no-api");
  await expect(page.locator("#path-text")).toContainText("this browser has no on-device model");
  await page.click("#recording-btn");
  const dialog = page.getByRole("dialog", { name: "A recorded on-device run" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("This is a recording, not a live answer.");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("the answer shows one disclaimer, in the reader's language", async ({ page }) => {
  await page.goto("/?ai=demo&fakeDevice=available&lang=es");
  await page.selectOption("#sample", "rent");
  await page.click("#read-btn");
  await expect(page.getByTestId("source-pill")).toBeVisible();
  await expect(page.locator("#answer")).toContainText("Esto no es asesoramiento legal.");
  await expect(page.locator("#answer")).not.toContainText("This is not legal advice");
});
