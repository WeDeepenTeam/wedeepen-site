// Cloudflare Worker: wedeepen-join-optin
// Consent log for the opt-in form on wedeepen.com/join/ (js/optin.js). It
// replaces the Supabase function join-optin, which was never deployed.
//
// The browser does the sign-ups itself, the same way the site popup and the
// checkout email step do (MailerLite and SimpleTexting both refuse requests
// sent from a Cloudflare Worker). It then posts here, and this Worker stores
// one row per submission in D1 (database wedeepen-optin, table
// optin_consents): exact consent wording and version, time, IP, country, user
// agent, page, and what MailerLite / SimpleTexting answered. This is the proof
// of consent behind the toll-free number (833-407-0037).
//
// Read records: npx wrangler d1 execute wedeepen-optin --remote \
//   --command "SELECT created_at, email, sms_consent, mailerlite_status, simpletexting_status FROM optin_consents ORDER BY created_at DESC LIMIT 20"

function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const ok = /^https:\/\/(www\.)?wedeepen\.com$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://wedeepen.com',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' });

    try {
      const body = await req.json().catch(() => ({}));
      const firstName = str(body.first_name, 100);
      const email = str(body.email, 320).toLowerCase();
      const phoneE164 = str(body.phone_e164, 20) || null;
      const emailConsent = body.email_consent === true;
      const smsConsent = body.sms_consent === true;

      // Same rules as the form (js/optin.js).
      if (!firstName) return json(req, 400, { error: 'First name is required.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(req, 400, { error: 'Valid email is required.' });
      if (phoneE164 && !/^\+1\d{10}$/.test(phoneE164)) return json(req, 400, { error: 'Phone must be a 10-digit US number.' });
      if (smsConsent && !phoneE164) return json(req, 400, { error: 'Phone is required for text consent.' });

      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO optin_consents (id, first_name, email, phone_e164, email_consent, sms_consent,
           consent_language_version, consent_language_text, source_url, user_agent, client_timestamp,
           ip_address, country, mailerlite_status, simpletexting_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
      ).bind(
        id, firstName, email, phoneE164, emailConsent ? 1 : 0, smsConsent ? 1 : 0,
        str(body.consent_language_version, 40) || null,
        str(body.consent_language_text, 2000) || null,
        str(body.source_url, 500) || null,
        (req.headers.get('user-agent') || '').slice(0, 500) || null,
        str(body.timestamp, 40) || null,
        req.headers.get('cf-connecting-ip') || null,
        (req.cf && req.cf.country) || null,
        str(body.mailerlite_status, 200) || null,
        str(body.simpletexting_status, 200) || null,
      ).run();

      return json(req, 200, { ok: true, id });
    } catch (err) {
      console.error('join-optin failed', err && err.message);
      return json(req, 500, { error: 'Not saved' });
    }
  },
};
