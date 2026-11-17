# Measurements: Gemini Nano in Chrome, through Firebase AI Logic

Measured on 2026-11-17 on a Mac (Apple silicon) running Google Chrome 157.0.8103.79, using a fresh, dedicated profile with no sign-in. The on-device model was downloaded once by `initializeDeviceModel()` (about 4 GB on disk). Every run used the invented sample letters in `src/samples/letters.ts`. Raw results are in `docs/measurements/`.

## 1. Answers (four fields), `InferenceMode.ONLY_ON_DEVICE`

Expected answers were written before the runs and compared by hand.

| Letter | Reader language | Correct fields | Notes | Latency |
|---|---|---|---|---|
| Rent increase (English) | English | 4 / 4 | | 18.7 s (first call, cold) |
| Rent increase | Spanish | 4 / 4 | | 5.9 s |
| Insurance reminder (German) | English | 4 / 4 | Includes the 5.00 EUR fee | 6.0 s |
| Insurance reminder (German) | Spanish | 3.5 / 4 | "What you must do" leaves out the amount (64,20 EUR) | 6.4 s |
| School attendance (English) | English | 4 / 4 | | 4.4 s |
| School attendance | Spanish | 4 / 4 | Says "call"; the letter allows phone or email | 6.0 s |

- `inferenceSource` was `on_device` for every call, and the page recorded **0 network requests** during the checks.
- Product run (rent letter, Spanish, through the real UI): `inferenceSource: on_device`, 0 external requests while reading, 16.5 s (cold).

### What we changed because of it
- **Output language.** With the first prompt, Nano answered in **English** for every Spanish request (3/3 explain runs in `nano-verify-run1-old-prompt.json`; 3/3 again in a direct A/B test). Adding "Write every value in Spanish, even though the letter and these instructions are in English" and a closing "Answer in Spanish." gave **Spanish in 3/3 A/B runs, in all 3 Spanish checks of the next verify run, and in the product run**. The fix is in `src/ai/prompt.ts`.
- **Guard.** The app also checks the language Nano actually wrote. A wrong-language answer, or one with missing fields, is never shown: the reader is taken to the masked review instead, with the reason on screen (`src/ai/firebase.ts`, `src/main.ts`).
- **Deadline field.** "Copy the deadline exactly as the letter writes it" made Nano return German text ("Bis zum 17. November 2026") to a Spanish reader. The field now asks for "the deadline date from the letter". The page still tells the reader to check dates and amounts against the letter.
- **Waiting copy.** The first on-device answer after a cold start took 16 to 19 s, so the working message says it can take up to 20 seconds.

## 2. Finding names for masking (on device)

| Letter | Names Nano found | Names left in the masked copy |
|---|---|---|
| Rent | Maria Elena Okafor, Jordan Reyes | none |
| Insurance (German) | Amira Haddad | none |
| School | Tomasz Novak, Priya Castellanos | none |

About 0.8 to 0.9 s per letter. The fixed patterns alone already hid every name in these samples. Nano's names are a second, independent check: a name is used only if it appears verbatim in the letter.

## 3. Reading a photo (image input on device)

The photos are synthetic: renders of the three sample letters with perspective, rotation, blur, low contrast, shadow and JPEG quality 55. **Real phone photos are not measured.**

"Key fields" means five strings per letter (name, reference number, deadline, amount, phone or date of birth) that must come out exactly.

| Photo | Gemini Nano (on device) | Tesseract (in-browser, no AI) |
|---|---|---|
| Rent, angled | 99.3% characters, 5/5 key fields | 98.0%, 4/5 |
| Rent, shadow | 99.8%, 5/5 | 96.6%, 2/5 |
| Rent, harsh | 98.0%, 5/5 | 69.5%, 2/5 |
| School, angled | 100%, 5/5 | 97.8%, 5/5 |
| School, shadow | 100%, 5/5 | 97.2%, 4/5 |
| School, harsh | 95.1%, 4/5 | 77.7%, 5/5 |
| Insurance (German), angled | 97.7%, 4/5 (misread the name) | 96.9%, 5/5 |
| Insurance (German), shadow | 98.6%, 5/5 | 95.1%, 2/5 |
| Insurance (German), harsh | 95.7%, 5/5 | 55.4%, 4/5 |
| **Total key fields** | **43 / 45** | **33 / 45** |

Nano took 4.8 to 7.7 s per photo and Tesseract 0.5 to 0.7 s. Decision: the on-device model reads photos when it is available. Tesseract stays as an opt-in fallback for browsers without one; it is weaker on poor photos, so the reader always checks the text before reading.

## 4. Cloud path (masked)

| Where | App Check | `generateContent` | `inferenceSource` |
|---|---|---|---|
| localhost, debug token | `exchangeDebugToken` 200 | 200 (`gemini-3.5-flash-lite`) | `in_cloud` |
| https://plain-letter-hybrid.web.app, reCAPTCHA Enterprise | `exchangeRecaptchaEnterpriseToken` 200 | 200 | `in_cloud` |

Cloud answers came back in 2.3 to 2.7 s, in the reader's language, with the placeholders put back on the device.
