# Plain Letter

**Understand an official letter without handing it over.**

Official letters (rent increases, tax and benefit decisions, insurance reminders, school notices) are hard to read in a second language or under stress. They also carry exactly the details you should not paste into a cloud chatbot: your name, address, date of birth, and account and case numbers.

Plain Letter answers four questions in plain words, in the reader's language: *what is this, what must I do, by when, and what happens if I do nothing*. It adds a few questions to ask. It uses Firebase AI Logic hybrid inference as a **privacy boundary**:

- **On this device first.** When Chrome's on-device model (Gemini Nano) can handle the letter, the letter never leaves the browser. That covers its languages (English, Spanish, German, French and Japanese), a letter that fits its context window, and a downloaded model. The ledger says so: *0 requests carried letter text*.
- **Masked cloud only after you check it.** When the device cannot do it (the letter is too long, you need another language, or there is no on-device model), Plain Letter hides personal details **on the device** first. It uses fixed patterns plus names found by the on-device model. You review the exact masked copy and add or remove items before anything is sent. Only that copy goes to Gemini in the cloud, and the placeholders are filled back in on your device.
- **A ledger of what left this device.** Every outgoing request is recorded with its exact body. An end-to-end test asserts that the cloud request contains none of the sensitive strings and equals what the ledger shows.
- **Offline, with no model:** rule-based extraction of deadlines, amounts and requests, and nothing leaves.

### Why not just `PREFER_ON_DEVICE`?

With `InferenceMode.PREFER_ON_DEVICE`, the SDK falls back to the cloud on its own whenever the on-device model is unavailable or still downloading. For this app that would mean sending the whole raw letter. Plain Letter never puts raw letter text in a model that may run in the cloud:

| Model instance | Mode | Gets |
| --- | --- | --- |
| explain, find names, read photo | `InferenceMode.ONLY_ON_DEVICE` | raw letter or photo |
| explain masked | `InferenceMode.ONLY_IN_CLOUD` | masked copy, after you confirm |

The app makes the routing decision itself, from the model's availability, a token budget inside the 9,216-token on-device window, and the input and output languages. It then checks `response.inferenceSource` after every call (a privacy invariant: raw text must come back `on_device`).

## Where Firebase AI Logic is called

- `src/ai/firebase.ts` uses `getAI`, `GoogleAIBackend`, `getGenerativeModel` with `InferenceMode.ONLY_ON_DEVICE` / `ONLY_IN_CLOUD`, `initializeDeviceModel`, and `generateContent` with structured output: `onDeviceParams.promptOptions.responseConstraint` on device, `responseMimeType` + `responseSchema` in the cloud. It reads `inferenceSource` on every response.
- `src/config/boot.ts`: Firebase App, **App Check** (reCAPTCHA Enterprise; debug provider for local development only), and **Remote Config** for the cloud model name and the on-device token budget.
- `src/route/decide.ts`: the routing decision (unit-tested as a table).
- `src/mask/`: on-device masking and restoring (unit and property tests).
- `src/ledger/recorder.ts`: the "What left this device" recorder.

## Run it

Requirements: Node 20+.

```bash
npm install
npm run dev          # http://127.0.0.1:5190 (demo mode if no Firebase config is set)
npm test             # unit and property tests (vitest + fast-check)
npx playwright install chromium
npm run e2e          # end-to-end tests; every Google endpoint is intercepted, no project needed
npm run build
```

Demo mode (`?ai=demo`) uses a rule-based stand-in and labels itself as such. It exists for development and for the tests of on-device states that a test browser cannot produce.

For the real on-device model, use **Google Chrome on desktop, version 139 or later**: macOS 13+, Windows 10/11 or Linux, about 22 GB free disk, and a GPU with more than 4 GB VRAM or 16 GB RAM. Press **Prepare the private reader** once to download the model.

<!-- Testing instructions for judges, the hosted URL and the console setup are added when the Firebase project is live. -->

## Sample letters

The sample letters in `src/samples/letters.ts` are invented. They contain no real people, organisations, reference numbers or letterheads.

## Use of AI in development

This project was built with an AI coding agent (Claude Code), working under a human lead who reviewed it at each gate. The agent wrote most of the code, tests and documentation. The human did the Firebase console setup, reviewed decisions and ran the final checks. The app's own AI features run only through Firebase AI Logic.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
