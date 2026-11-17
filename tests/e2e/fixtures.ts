import type { Page, Request } from "@playwright/test";

export interface CloudCall {
  body: string;
  url: string;
}

/** Answer the model would give for a masked letter; it echoes placeholders so restore can be checked. */
export function fakeGeminiAnswer(extra = "") {
  const answer = {
    what_this_is: "A notice from [NAME_1]'s landlord about a rent increase." + extra,
    what_you_must_do: "Nothing, if you accept. To refuse, write by April 1, 2026.",
    by_when: "April 1, 2026",
    if_you_do_nothing: "The new rent of $1,595.00 starts on May 1, 2026.",
    questions_to_ask: ["Is this increase allowed under my lease?"],
  };
  return { candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(answer) }] }, finishReason: "STOP", index: 0 }] };
}

/**
 * Intercepts every Google endpoint the app could call. Cloud generateContent
 * calls are captured and answered by `respond`.
 */
export async function interceptGoogle(page: Page, respond: (req: Request) => { status: number; json: unknown } = () => ({ status: 200, json: fakeGeminiAnswer() })) {
  const calls: CloudCall[] = [];
  await page.route("https://content-firebaseappcheck.googleapis.com/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "e2e-appcheck-token", ttl: "3600s" }) }),
  );
  await page.route(/firebaseremoteconfig|firebaseinstallations|firebaselogging|recaptcha/, (r) => r.abort());
  await page.route("https://firebasevertexai.googleapis.com/**", async (r) => {
    calls.push({ body: r.request().postData() ?? "", url: r.request().url() });
    const { status, json } = respond(r.request());
    await r.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
  });
  return calls;
}
