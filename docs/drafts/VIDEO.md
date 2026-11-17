# Demo video: script and shot list (target 2:40, hard limit 2:50)

English voice-over (or English captions over silence). The video is rendered elsewhere from screen captures in `docs/video/`. Every shot shows the real app at https://plain-letter-hybrid.web.app.

Captures still needed are marked **[CAPTURE]**. The on-device shots need real Google Chrome with Gemini Nano (pending access).

| # | Time | Shot | Voice-over |
|---|------|------|------------|
| 1 | 0:00–0:12 | Close-up of the invented rent notice (the sample text), names and account number visible. | "This is the kind of letter people get every week: a rent increase, with a deadline, written for lawyers. It also has your name, your address and your account number on it." |
| 2 | 0:12–0:22 | A generic chat box with the letter pasted in, blurred, then a cut. (Use our own mock text field, no real product UI.) | "The usual advice is: paste it into a chatbot. That hands your identity to a cloud service." |
| 3 | 0:22–0:32 | Plain Letter start screen, desktop. Top bar: *Private reader: ready*, *Online*. **[CAPTURE in real Chrome]** | "Plain Letter reads it on your device instead, with Gemini Nano in Chrome, through Firebase AI Logic." |
| 4 | 0:32–0:55 | Pick the rent sample, choose Español, press Read. The answer appears with the teal tag *Read on this device*. The ledger below: *Stayed on this device*, 0 requests. Captured: `docs/video/03-04-on-device-read.webm` (real Chrome 157, re-recorded after the final copy changes). | "What is this, what must I do, by when, what if I do nothing: in plain Spanish, read by Gemini Nano on this laptop. Nothing was sent." |
| 5 | 0:55–1:10 | Scroll to the ledger: *Stayed on this device. Nothing was sent. 0 requests carried letter text.* | "Every reading is logged in a ledger of what left this device." |
| 6 | 1:10–1:25 | Pick the 6-page benefit decision, press Read. Reasons appear: *too long for the on-device model*. | "This one is six pages, too long for the on-device model. So instead of quietly sending it to the cloud, Plain Letter hides your personal details first, on the device." |
| 7 | 1:25–1:45 | Review screen: the hidden details list (name, address, NI number, date of birth), the highlighted masked copy. Type "Housing Support" into *Hide something else*. | "You see exactly what would be sent. Names, address, case number, date of birth: replaced. Deadlines and amounts stay, because the answer needs them. You can hide more." |
| 8 | 1:45–2:05 | Press *Send this masked copy*. Answer appears tagged *Read in the cloud, masked*. Open the ledger entry: *Exact request body*, with the Network panel's request payload side by side. | "Only now does anything leave. Gemini answers the masked copy; your details are put back here, on your device. The ledger shows the request body byte for byte, and our tests check it matches what was sent." |
| 9 | 2:05–2:20 | The *Why not just let the SDK choose?* panel; quick cut to the code: `InferenceMode.ONLY_ON_DEVICE` for the letter, `ONLY_IN_CLOUD` for the masked copy. | "Firebase AI Logic's PREFER_ON_DEVICE mode would have sent the raw letter whenever the model was missing or still downloading. So we use two models: on-device only for your letter, cloud only for the copy you approved." |
| 10 | 2:20–2:32 | Phone viewport (no on-device model): same flow through review. Then offline toggle: rule-based deadlines and amounts, *Stayed on this device*. | "On a phone or offline it still works, and it still never sends the letter you did not approve." |
| 11 | 2:32–2:40 | Logo text *Plain Letter* and the URL. | "Plain Letter. Understand a letter without handing it over." |

## Captures to produce (`docs/video/`)
- `01-letter-closeup.png`: the rent sample text, zoomed (from the app's textarea).
- `03-start-chrome.mp4`, `04-on-device-read.mp4`: **real Chrome**, Network panel visible. **[BLOCKED: needs Chrome access]**
- `06-08-masked-cloud.mp4`: the benefit sample through review and send. Can be captured now from the hosted app.
- `10-phone-offline.mp4`: phone viewport plus offline.
- `09-code.png`: the two `getGenerativeModel` calls in `src/ai/firebase.ts`.

## Rules
- All sample letters are invented and say so on screen ("SAMPLE LETTER - invented for demonstration").
- No real brand UI in shot 2; use a neutral text box.
- No claim in the voice-over that is not shown on screen.
