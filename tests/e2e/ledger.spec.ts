import { expect, test } from "@playwright/test";
import { BENEFIT_REVIEW, RENT_NOTICE } from "../../src/samples/letters";
import { interceptGoogle } from "./fixtures";

// Playwright's Chromium has no on-device model, so every letter goes down the masked cloud path.
test("the cloud request carries no sensitive string and equals what the ledger shows", async ({ page }) => {
  const calls = await interceptGoogle(page);
  await page.goto("/");
  await expect(page.locator("#device-pill")).toContainText(/Private reader: not/);
  await page.selectOption("#sample", "rent");
  await page.click("#read-btn");

  // Review step: nothing sent yet.
  await expect(page.getByTestId("masked-preview")).toBeVisible();
  expect(calls).toHaveLength(0);
  const preview = await page.getByTestId("masked-preview").textContent();
  for (const s of RENT_NOTICE.sensitive) expect(preview).not.toContain(s);

  await page.click("#send-btn");
  await expect(page.getByTestId("source-pill")).toHaveText("Read in the cloud, masked");

  expect(calls).toHaveLength(1);
  const body = calls[0]!.body;
  expect(calls[0]!.url).toContain(":generateContent");
  for (const s of RENT_NOTICE.sensitive) expect(body, `leaked: ${s}`).not.toContain(s);
  // The masked letter in the body is exactly the previewed copy.
  const sentText = (JSON.parse(body) as { contents: { parts: { text: string }[] }[] }).contents[0]!.parts[0]!.text;
  expect(sentText).toContain(preview!);

  // The ledger shows the request body byte for byte.
  const shown = await page.getByTestId("ledger-body").textContent();
  expect(shown).toBe(body);

  // Placeholders came back and were restored on the device.
  await expect(page.locator(".explain")).toContainText("A notice from Maria Elena Okafor's landlord");
});

test("a long letter is masked, and the user's own additions are hidden too", async ({ page }) => {
  const calls = await interceptGoogle(page);
  await page.goto("/");
  await page.selectOption("#sample", "benefit");
  await page.click("#read-btn");
  await expect(page.locator(".reasons")).toContainText("too long for the on-device model");
  await page.fill("#add-value", "Housing Support");
  await page.click("text=Hide it");
  await expect(page.getByTestId("masked-preview")).not.toContainText("Housing Support");
  await page.click("#send-btn");
  await expect(page.getByTestId("source-pill")).toBeVisible();
  expect(calls).toHaveLength(1);
  for (const s of [...BENEFIT_REVIEW.sensitive, "Housing Support"]) expect(calls[0]!.body).not.toContain(s);
  expect(await page.getByTestId("ledger-body").textContent()).toBe(calls[0]!.body);
});

test("cancelling sends nothing", async ({ page }) => {
  const calls = await interceptGoogle(page);
  await page.goto("/");
  await page.selectOption("#sample", "school");
  await page.click("#read-btn");
  await page.click("text=Do not send");
  await expect(page.locator("#answer")).toContainText("Nothing was sent");
  expect(calls).toHaveLength(0);
  await expect(page.locator("#ledger-summary")).toContainText("No letter text has left this device");
});

test("quota and App Check failures are explained, and nothing is retried silently", async ({ page }) => {
  let n = 0;
  const calls = await interceptGoogle(page, () => (++n === 1 ? { status: 429, json: { error: { code: 429, message: "Resource exhausted", status: "RESOURCE_EXHAUSTED" } } } : { status: 403, json: { error: { code: 403, message: "App Check token is invalid.", status: "PERMISSION_DENIED" } } }));
  await page.goto("/");
  await page.selectOption("#sample", "rent");
  await page.click("#read-btn");
  await page.click("#send-btn");
  await expect(page.locator("[data-error]")).toHaveAttribute("data-error", "quota");
  expect(calls).toHaveLength(1);
  await page.getByRole("button", { name: "Try again" }).click();
  await page.click("#send-btn");
  await expect(page.locator("[data-error]")).toHaveAttribute("data-error", "app-check");
  expect(calls).toHaveLength(2);
});
