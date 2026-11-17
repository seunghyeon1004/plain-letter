# Demo video package: Plain Letter (target 2:40, hard limit 2:50)

Everything the video bot needs is in this folder. Captions are English and must be burned in. They are in `captions.srt`, with the same text in the table below. No voice-over is required; if one is added, read the caption text.

All app footage is the real app at https://plain-letter-hybrid.web.app. All letters are invented samples and say "SAMPLE LETTER" on screen. Footage is page-only browser video; no desktop or other windows appear.

## Source files

| File | What it is | Length |
|---|---|---|
| `C-naive-vs-plain-letter.png` / `.webm` | Side by side: the same letter as sent by a one-model `PREFER_ON_DEVICE` app (9 of 9 personal details sent) vs Plain Letter (0 of 9). Built from real Firebase AI Logic request bodies, captured in a browser with no on-device model; facts in `C-facts.json` | still, or 9 s |
| `A-on-device-read-network-log.webm` | Real Google Chrome 157 with Gemini Nano: rent letter, explained in Spanish on device. The dark overlay (bottom right) is Chrome's own network log from the DevTools Protocol: it stays at **0 requests**. Facts in `capture-facts.json` (A) | 33 s |
| `B-masked-cloud-ledger-equals-request.webm` | Real Chrome, a 6-page letter: names found on device, the masked review, *Send this masked copy*, the answer, then the ledger's exact request body. The network log shows that one request. Facts in `capture-facts.json` (B) | 50 s |
| `E-proof.png` | Card: what we tested and measured | still |
| `03-04-on-device-read.webm` | Same scene as A without the overlay (also used inside the app as the labelled recording) | 29 s |

## Edit list

Times on the left are in the finished video; source times are in brackets.

| # | Video time | Source | Edit | Caption (burn in) |
|---|---|---|---|---|
| 1 | 0:00–0:08 | `C-naive-vs-plain-letter.png`, crop to the left panel's letter text | Slow push-in on the black-marked name and address | Official letters carry your name, address and account number. |
| 2 | 0:08–0:16 | same | Hold | Pasting one into a cloud chatbot hands all of that over. |
| 3 | 0:16–0:30 | `C-naive-vs-plain-letter.png`, full frame | Hold, then zoom to the two counters | Firebase AI Logic can run Gemini on your device. But in PREFER_ON_DEVICE mode, if this browser has no model, the SDK sends the raw letter to the cloud: 9 of 9 details. |
| 4 | 0:30–0:38 | same, zoom to the right panel | Hold | Plain Letter never does. The cloud only ever gets a masked copy you approved: 0 of 9. |
| 5 | 0:38–0:46 | A [0:00–0:08] | Real time | In Chrome with Gemini Nano, the letter is read on this device. |
| 6 | 0:46–0:55 | A [0:08–0:26] | Speed up 2x; add a small "2x" label | Reading on device. Chrome's network log (bottom right) stays at 0 requests. |
| 7 | 0:55–1:05 | A [0:26–0:33] | Real time; hold the last frame 3 s | The answer, in Spanish: what it is, what to do, by when, what if you do nothing. Nothing was sent. |
| 8 | 1:05–1:13 | B [0:00–0:07] | Real time | A six-page letter is too long for the on-device model. |
| 9 | 1:13–1:20 | B [0:07–0:27] | Speed up 3x; "3x" label | So Plain Letter hides personal details first, on the device. |
| 10 | 1:20–1:38 | B [0:27–0:37] | Real time; hold on the hidden-details list and the masked copy | You see exactly what would be sent. Names, address, case number, date of birth: replaced. Deadlines and amounts stay. |
| 11 | 1:38–1:50 | B [0:37–0:45] | Real time | Only after you press Send does anything leave. Gemini in the cloud answers; your details are put back on your device. |
| 12 | 1:50–2:08 | B [0:45–0:50], then hold the last frame | Hold ~13 s | The ledger shows the exact request body. One request in Chrome's log. Our tests check that the two are identical and contain none of your details. |
| 13 | 2:08–2:25 | `E-proof.png` | Hold | Tested: masking, the ledger, the naive mode. Measured on real Gemini Nano: 23.5 of 24 answer fields right, every name found. |
| 14 | 2:25–2:38 | Title card (text only): "Plain Letter", then "plain-letter-hybrid.web.app" | Fade | Plain Letter. Understand a letter without handing it over. |

Total: 2:38.

## Facts behind the captions
- Shot 3: `C-facts.json` → `naiveSource: in_cloud`, 9 of 9 sensitive strings in the naive body, 0 in Plain Letter's. The same check runs as a test in `tests/e2e/naive.spec.ts`.
- Shots 5–7: `capture-facts.json` A → `inferenceSource: on_device`, `letterRequests: []`, `networkLog: []`.
- Shots 8–12: `capture-facts.json` B → `inferenceSource: in_cloud`, one `generateContent` request (200, 36,774 bytes), and the network log shows only that call (its CORS preflight and the POST).
- Shot 13: `../MEASUREMENTS.md`.

## How the captures were made
- `node scripts/real-chrome-video.mjs` makes A and B (real Chrome, dedicated profile, page-only video).
- `node scripts/capture-compare.mjs` makes C (bundled Chromium, requests intercepted locally).
- E is `E-proof.html` rendered at 1440×900.
