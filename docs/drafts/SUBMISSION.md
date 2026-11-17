# Devpost submission draft: Plain Letter

> Draft for the lead. Every claim below must match the hosted app and the repo on submission day.
> On-device claims were verified in real Chrome 157 on 2026-11-17 (see docs/MEASUREMENTS.md).

## Project name
Plain Letter

## Tagline (short)
Understand an official letter without handing it over.

## Platform
Web (Chrome)

## Links
- Hosted app: https://plain-letter-hybrid.web.app
- On-device check page: https://plain-letter-hybrid.web.app/verify.html
- Code: https://github.com/seunghyeon1004/plain-letter (Apache-2.0)
- Video: (YouTube link, to add)

## Inspiration
A letter from a landlord, a benefits office, an insurer or a school is often the most important thing someone reads that week, and the hardest. It is written in formal language, sometimes in a language that is not the reader's own, and it arrives when the reader is already worried. The usual advice is "paste it into a chatbot". But that letter carries exactly what you should not hand over: your name, address, date of birth, and account and case numbers.

Firebase AI Logic's hybrid inference let us build the alternative properly: read the letter **on the device**, and when the cloud is needed, send it **only a masked copy the reader has checked**.

## What it does
Paste a letter, drop a photo, or pick an invented sample, and choose the language to explain it in. Plain Letter answers four questions in plain words: **what this is, what you must do, by when, and what happens if you do nothing**. It adds up to three questions the reader could ask the sender or an adviser.

- **On this device first.** If Chrome's built-in Gemini Nano is ready, the letter fits its window, and the languages are ones it supports (English, Spanish, German, French, Japanese), the letter is read entirely in the browser. The ledger then says: *Nothing was sent. 0 requests carried letter text.* (Measured: `inferenceSource: on_device`, 0 external requests while reading.)
- **Masked cloud, only after the reader approves it.** If the device cannot do it (a long multi-page decision, a reader language Nano cannot write such as Korean or Arabic, or no on-device model in this browser), Plain Letter hides names, addresses, dates of birth, account, case and reference numbers, phone numbers and emails, **on the device**. It uses fixed patterns, plus names the on-device model finds when it is available. The reader sees the exact masked copy, can un-hide or add items, and presses *Send this masked copy*. Gemini in the cloud explains the masked copy; the placeholders are filled back in on the device. Deadlines and amounts stay visible, because the answer depends on them.
- **A ledger of what left this device.** Every request the page sends is listed with its exact body, byte for byte, and every file it loads from another site is listed by address. An end-to-end test asserts that the cloud request contains none of the sensitive strings and equals what the ledger shows.
- **Offline and no model?** Rule-based extraction of deadlines, amounts and requests, and still nothing leaves.
- **Photos never upload.** A photo is read by the on-device model, or, without one, by text recognition that runs in the browser (no AI). The reader then checks the text.

## How we built it: how Firebase AI Logic is used
- **Two kinds of model instances, never mixed** (`src/ai/firebase.ts`):
  - `getGenerativeModel(ai, { mode: InferenceMode.ONLY_ON_DEVICE, onDeviceParams })` for everything that contains the raw letter: explaining it, finding personal names for masking, and reading a photo (JPEG/PNG as inline data).
  - `getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams })` for the masked copy only.
- **Why not `PREFER_ON_DEVICE`?** With that mode the SDK silently falls back to the cloud when the on-device model is unavailable or still downloading. Here that would send the raw letter. The app shows this reasoning on the page.
- **Our own routing** (`src/route/decide.ts`, table-tested) decides from `LanguageModel.availability()` for the exact input and output languages, a token budget inside the 9,216-token on-device window, the letter's language and the reader's language, and whether the reader is online.
- **`initializeDeviceModel()`** runs from a *Prepare the private reader* button (a user gesture), with download progress.
- **Structured output on both paths**, with one JSON shape: `onDeviceParams.promptOptions.responseConstraint` on device, and `responseMimeType: "application/json"` + `responseSchema` (built with `Schema`) in the cloud.
- **`response.inferenceSource` is checked after every call.** If raw text did not come back `on_device`, the app stops (a privacy invariant). The ledger is driven by the same signal.
- **App Check** with reCAPTCHA Enterprise in production, and the debug provider for local development only (the token lives in a gitignored env file). **Remote Config** holds the cloud model name (`gemini-3.5-flash-lite` on the free Gemini Developer API) and the on-device token budget. **Firebase Hosting** serves the app.
- No backend and no database: the product stores nothing server-side, by design.

## How well Gemini Nano does the job (measured)
On the three sample letters in real Chrome, Nano got 23.5 of 24 answer fields right in English and Spanish, found every person's name for masking, and read synthetic photos of the letters with 43 of 45 key fields exact. With our first prompt, it answered in English when asked for Spanish. We fixed the prompt, and the app now checks the language and completeness of every on-device answer: a weak answer is never shown, and the reader is offered the masked cloud path instead. Details: [docs/MEASUREMENTS.md](https://github.com/seunghyeon1004/plain-letter/blob/main/docs/MEASUREMENTS.md).

### Honest limits
- On-device reading needs desktop Google Chrome 139 or later, about 22 GB of free disk, and a GPU with more than 4 GB VRAM or 16 GB RAM. Everyone else, including phones, gets the masked cloud path. Before you press Read, the page says which path your browser will take, and it offers a labelled recording of a real on-device run.
- The on-device model writes English, Spanish, German, French and Japanese. Other reader languages use the masked cloud path.
- Photo reading was measured on synthetic photos only. Real phone photos are not measured.
- Masking can miss something unusual, which is why the reader reviews the masked copy before anything is sent.

## Challenges we ran into
- **Masking that keeps the meaning.** Hiding every date would destroy "by when", so the policy hides who you are and how to find you, but keeps deadlines and amounts. Placeholders are chosen so they can never collide with text already in the letter. Property tests check that `restore(mask(x)) === x` for any text.
- **Testing on-device behaviour.** Browsers we could automate do not run the real Gemini Nano. We added a demo mode for UI states, and `verify.html`, a one-click page that runs the samples through `ONLY_ON_DEVICE` in real Chrome and saves the results as JSON.
- **The on-device window and languages are limits**, so we treated them as routing inputs, not errors.
- **Nano's output language.** It drifted to English until the prompt said twice which language to write in. A guard now checks every answer.

## Accomplishments we are proud of
- The privacy promise is **shown, not claimed**: the reader sees the exact bytes that left the device.
- Raw letter text can only go to an `ONLY_ON_DEVICE` model. That is enforced in code and covered by tests.
- 49 unit and property tests, and 19 end-to-end tests including axe accessibility (0 serious violations), keyboard-only use, a phone viewport and offline.

## What we learned
Hybrid inference is more than a fallback. The choice between `PREFER_ON_DEVICE` and two explicit modes is a product decision about whose data goes where.

## What's next
- Tests with real letters from people who volunteer them (redacted), and with advice organisations.
- More on-device languages as Chrome adds them.
- Android with Gemini Nano through the same SDK.

## Built during the submission period
All code was written from 17 November 2026 onward, in a new repository. No code existed before the submission period.

## Value proposition
For people who must act on an official letter they cannot easily read, Plain Letter gives a plain answer to "what do I do, and by when?" without giving their identity to a cloud service. When the cloud must help, they see and approve exactly what it receives.

## Testing instructions (no secrets needed)
1. Open https://plain-letter-hybrid.web.app in **Google Chrome on desktop** (139+; macOS 13+, Windows 10/11 or Linux; at least 22 GB free disk; a GPU with more than 4 GB VRAM or 16 GB RAM).
2. If the top bar says *Private reader: not downloaded*, press **Prepare the private reader** (one-time download, several minutes).
3. Choose **Sample: Rent increase notice**, choose **Español**, and press **Read this letter**. The answer is tagged *Read on this device*, and the ledger shows *0 requests carried letter text*. The first on-device reading after a cold start can take up to 20 seconds.
4. Choose **Sample: Benefit overpayment review (long, 6 pages)** and press **Read this letter**. It is too long for the device: check the masked copy, press **Send this masked copy**, then open the ledger entry to see the exact request body.
5. Without the on-device model (any other browser or a phone), steps 3 and 4 both use the masked cloud path.
6. Without an on-device model, press **See a recorded on-device run** for a labelled recording made in Chrome 157, with its measured numbers.
7. Optional: open `/verify`, then press Prepare, Run and Save to download a JSON record of the on-device checks.
8. To check the privacy claim yourself, open DevTools > Network and compare the one `generateContent` request with **What left this device > Exact request body** (see the README).

All sample letters are invented. No login is needed.

## Built with
Firebase AI Logic (hybrid inference, Gemini Nano on device, Gemini Developer API in the cloud), Firebase App Check (reCAPTCHA Enterprise), Firebase Remote Config, Firebase Hosting, Chrome Prompt API, TypeScript, Vite, Vitest, fast-check, Playwright, axe-core, tesseract.js, Epilogue and IBM Plex Mono (self-hosted).
