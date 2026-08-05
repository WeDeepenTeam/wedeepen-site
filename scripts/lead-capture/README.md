# Lead capture (popup + announcement bar)

`/js/lead-capture.js` injects two things on every page that includes it:

1. **Announcement bar** (top of page). Device-aware:
   - **Mobile**: "Get on the list: text COUNT ME IN to 833-407-0037" with a "Text us" button. Both open Messages pre-filled with the keyword (one tap, zero typing).
   - **Desktop**: "Get on the list: be the first to hear about new dates & events" with a "Join the list" button that opens the popup.
   - Dismissible; stays hidden 7 days.
2. **Popup** (auto-opens after 7 seconds on **desktop only**; on any device via the bar button or any element with a `data-lead-popup` attribute):
   - **Desktop**: first name + cell phone + SMS-consent checkbox, submitted directly to the SimpleTexting web form API (`joinContact`, web form "WebSite Pop-up"), which subscribes the contact to the **COUNTMEIN** list, the same list the keyword reaches. A fire-and-forget copy also goes to the **WeDeepen Leads** Google Sheet for page attribution. If SimpleTexting is unreachable, the visitor gets the "text COUNT ME IN" instruction and the lead is still logged to the sheet.
   - **Mobile**: SMS-first panel with a big "Text COUNT ME IN" button and a "Save WeDeepen to your contacts" vCard link.
   - Mobile auto-open is intentionally off: the bar's one-tap text beats a popup, and Google penalizes auto-interstitials in mobile search.

QA: append `?wd-view=mobile` or `?wd-view=desktop` to any page URL to force a variant.

Snooze rules (localStorage): popup dismissed = 7 days, popup submitted = 1 year, bar dismissed = 7 days.

## Google Sheets wiring — one-time setup (~3 minutes)

The destination sheet already exists: **WeDeepen Leads**
https://docs.google.com/spreadsheets/d/1A34rApBJ3PAKQeEUnmy5Jak2M_KSNkYhit3oXL7yDCg/edit

1. Open the sheet → **Extensions → Apps Script**.
2. Delete any placeholder code and paste the contents of [`google-apps-script.gs`](./google-apps-script.gs). Save.
3. **Deploy → New deployment → Web app.**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Authorize when prompted, then copy the **Web app URL** (ends in `/exec`).
5. In [`/js/lead-capture.js`](../../js/lead-capture.js), set:
   ```js
   var ENDPOINT = 'https://script.google.com/macros/s/…/exec';
   ```
6. Commit + push.

Until `ENDPOINT` is set, the popup still works but finishes with a fallback message telling the visitor to text COUNT ME IN to 833-407-0037, so no lead is lost.

## Notes

- Requests are sent `no-cors` (Apps Script web apps don't return CORS headers), so the client treats any network success as a submit. The Apps Script validates and appends server-side.
- A hidden honeypot field (`company`) silently drops bot submissions on both client and server.
- To add the popup/bar to a new page, add before `</body>`:
  ```html
  <script src="/js/lead-capture.js" defer></script>
  ```
- To make any button open the popup, give it `data-lead-popup`.
