#!/usr/bin/env node
/**
 * google-auth.mjs — one-time Google sign-in for the review sync.
 *
 * Run it on your own computer after the Google Cloud setup in
 * scripts/reviews/README.md. It opens Google's sign-in page, you approve access to the
 * WeDeepen Business Profile, and it finds the account and location IDs. With
 * --save it stores all five values as GitHub secrets through the gh CLI, so
 * nothing has to be copied by hand and nothing secret is printed.
 *
 *   GBP_CLIENT_ID=... GBP_CLIENT_SECRET=... node scripts/reviews/google-auth.mjs --save
 *
 * Without --save it prints the values instead (for running the sync locally).
 */
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';

const PORT = 8085;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = 'https://www.googleapis.com/auth/business.manage';
const SAVE = process.argv.includes('--save');

const clientId = process.env.GBP_CLIENT_ID?.trim();
const clientSecret = process.env.GBP_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) {
  console.error('Set GBP_CLIENT_ID and GBP_CLIENT_SECRET first (from the OAuth client in Google Cloud). See scripts/reviews/README.md.');
  process.exit(1);
}

async function getJSON(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  if (!res.ok) {
    const msg = body.error?.message || JSON.stringify(body);
    throw new Error(`${url}\n  ${res.status}: ${msg}${res.status === 403 || res.status === 429 ? '\n  If this mentions quota or access, Google has not approved Business Profile API access for this project yet.' : ''}`);
  }
  return body;
}

/** Wait for Google to redirect back to the local server with ?code=. */
function waitForCode(authUrl) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT);
      if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
      const code = url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(code
        ? '<p style="font:16px system-ui">Signed in. You can close this tab and go back to the terminal.</p>'
        : `<p style="font:16px system-ui">Sign-in failed: ${url.searchParams.get('error')}</p>`);
      server.close();
      code ? resolve(code) : reject(new Error(`Google returned: ${url.searchParams.get('error')}`));
    });
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`\nOpening Google sign-in. If no browser opens, visit:\n${authUrl}\n`);
      spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [authUrl], { stdio: 'ignore', detached: true }).on('error', () => {});
    });
  });
}

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',
  prompt: 'consent',
});
const code = await waitForCode(authUrl);

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
});
const tokens = await tokenRes.json();
if (!tokenRes.ok || !tokens.refresh_token) {
  console.error('No refresh token came back:', tokens.error_description || tokens.error || 'unknown error');
  process.exit(1);
}

const { accounts = [] } = await getJSON('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', tokens.access_token);
const found = [];
for (const a of accounts) {
  const { locations = [] } = await getJSON(`https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title&pageSize=100`, tokens.access_token);
  for (const l of locations) found.push({ account: a.name.split('/')[1], location: l.name.split('/')[1], title: l.title, accountName: a.accountName });
}
if (!found.length) {
  console.error('Signed in, but this Google account manages no Business Profile locations. Sign in with the account that owns WeDeepen Relationships.');
  process.exit(1);
}

const pick = found.find((f) => /wedeepen/i.test(f.title)) || found[0];
console.log('Business Profile locations on this account:');
for (const f of found) console.log(`  ${f === pick ? '→' : ' '} ${f.title}  (account ${f.account}, location ${f.location})`);

const secrets = {
  GBP_CLIENT_ID: clientId,
  GBP_CLIENT_SECRET: clientSecret,
  GBP_REFRESH_TOKEN: tokens.refresh_token,
  GBP_ACCOUNT_ID: pick.account,
  GBP_LOCATION_ID: pick.location,
};

if (SAVE) {
  for (const [name, value] of Object.entries(secrets)) {
    execFileSync('gh', ['secret', 'set', name, '--repo', 'WeDeepenTeam/wedeepen-site'], { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
  }
  console.log('\nSaved all five as GitHub secrets. Run the "Google reviews" workflow once to test it.');
} else {
  console.log('\nexport ' + Object.entries(secrets).map(([k, v]) => `${k}='${v}'`).join(' \\\n  '));
}
