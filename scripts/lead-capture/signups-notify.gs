/**
 * WeDeepen website sign-ups: second sheet + email notification.
 *
 * Standalone Apps Script project "WeDeepen Sign-ups Notifier" (owner r@wedeepen.com),
 * deployed as a web app (Execute as: Me, Who has access: Anyone). The popup in
 * /js/lead-capture.js posts every desktop sign-up here (SIGNUPS_ENDPOINT),
 * alongside the older WeDeepen Leads log.
 *
 * Each sign-up adds one row and emails NOTIFY_EMAIL.
 */

var SHEET_ID = '1p9MT4JFCsPyj5S1X-9OzqegnaUMkjd_VCngx5hjWXPE'; // WeDeepen Website Sign-ups
var NOTIFY_EMAIL = 'r@wedeepen.com';
var TZ = 'America/Chicago';

function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p.company) return json_({ ok: true }); // honeypot: bot, write nothing
  if (!p.firstName && !p.phone) return json_({ ok: false, error: 'missing fields' });

  var now = new Date();
  var clip = function (v, n) { return String(v || '').slice(0, n || 200); };
  var row = [
    Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
    Utilities.formatDate(now, TZ, 'h:mm a'),
    clip(p.firstName),
    clip(p.phone, 30),
    clip(p.email),
    clip(p.city, 100),
    clip(p.state, 10),
    clip(p.podcast, 5),
    clip(p.page),
    clip(p.hook, 60),
    clip(p.device, 20),
    clip(p.result, 60)
  ];

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    SpreadsheetApp.openById(SHEET_ID).getSheets()[0].appendRow(row);
  } finally {
    lock.releaseLock();
  }

  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'New WeDeepen sign-up: ' + (row[2] || row[3]),
      body: [
        'Someone just joined the list from the website.',
        '',
        'Name: ' + row[2],
        'Cell: ' + row[3],
        'Email: ' + (row[4] || '(none)'),
        'Location: ' + [row[5], row[6]].filter(String).join(', '),
        'Podcast texts: ' + row[7],
        'Page: ' + row[8],
        'When: ' + row[0] + ' ' + row[1] + ' Central',
        '',
        'All sign-ups: https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit'
      ].join('\n')
    });
  } catch (err) { /* the row is saved even if email fails */ }

  return json_({ ok: true });
}

// Opening the /exec URL in a browser confirms the deployment is live.
function doGet() {
  return json_({ ok: true, service: 'wedeepen-signups' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
