/**
 * WeDeepen lead capture — Google Apps Script web app.
 *
 * Paste this into the Apps Script editor BOUND to the "WeDeepen Leads" sheet
 * (open the sheet → Extensions → Apps Script), then deploy as a web app.
 * Full steps: scripts/lead-capture/README.md
 *
 * Appends one row per popup submission:
 * Timestamp | First Name | Email | Cell Phone | Location | Source Page
 */

function doPost(e) {
  var p = (e && e.parameter) || {};

  // Honeypot field filled = bot. Accept silently, write nothing.
  if (p.company) {
    return json_({ ok: true });
  }

  if (!p.email || !p.firstName) {
    return json_({ ok: false, error: 'missing fields' });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sheet.appendRow([
    new Date(),
    String(p.firstName).slice(0, 200),
    String(p.email).slice(0, 200),
    String(p.phone || '').slice(0, 50),
    String(p.location || '').slice(0, 200),
    String(p.page || '').slice(0, 200)
  ]);

  return json_({ ok: true });
}

// Lets you sanity-check the deployment by opening the /exec URL in a browser.
function doGet() {
  return json_({ ok: true, service: 'wedeepen-lead-capture' });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
