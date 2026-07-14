/**
 * WeDeepen opt-in form — single shared component.
 *
 * Renders into any element with [data-wd-optin]. Two variants:
 *   data-wd-optin="footer"  compact band at the top of the global footer
 *   data-wd-optin="page"    full-scale version for /join
 *
 * COMPLIANCE — read before editing:
 * The checkbox labels and compliance text below are carrier-reviewed copy.
 * Carriers scan for this language word for word when approving the toll-free
 * number registration (833-407-0037). Do NOT reword, shorten, hide, or
 * collapse any of it. Both checkboxes MUST stay unchecked by default and
 * MUST NOT be required (a pre-checked or forced SMS box is a TCPA violation).
 *
 * If the consent label text ever changes, bump CONSENT_LANGUAGE_VERSION so
 * stored consent records can be matched to the language a person agreed to.
 */
(function () {
  'use strict';

  if (window.__wdOptinLoaded) return;
  window.__wdOptinLoaded = true;

  // Submission endpoint: Supabase Edge Function (sister repo my-app) that
  // writes the consent record, then subscribes to Mailchimp and SimpleTexting
  // server-side. Until it is deployed, submissions show the fallback message.
  var ENDPOINT = 'https://oycfonjaufdihuwjecxu.supabase.co/functions/v1/join-optin';

  var CONSENT_LANGUAGE_VERSION = '2026-07-13';

  var EMAIL_CONSENT_TEXT = 'Yes, email me about WeDeepen events, retreats, and podcast episodes.';

  var SMS_CONSENT_TEXT = 'Yes, text me updates from WeDeepen about events, retreats, member sessions, and podcast episodes. Message frequency varies (about 2 to 6 messages per month). Message and data rates may apply. Reply STOP to unsubscribe, HELP for help. Consent is not a condition of purchase. See our Terms of Use and Privacy Policy.';

  var CSS = '' +
    '.wd-optin{color:rgba(255,255,255,0.85);font-family:"DM Sans","Inter",system-ui,sans-serif;text-align:left}' +
    '.wd-optin *{box-sizing:border-box}' +
    '.wd-optin-heading{font-family:"Playfair Display",Georgia,serif;color:#fff;line-height:1.15;margin:0 0 10px}' +
    '.wd-optin-sub{color:rgba(255,255,255,0.65);line-height:1.6;margin:0 0 4px;font-weight:300}' +
    '.wd-optin-keyword{color:rgba(255,255,255,0.65);font-size:0.9rem;margin:10px 0 0}' +
    '.wd-optin-keyword strong{color:#C9A277}' +
    '.wd-optin-fields{display:grid;gap:12px;margin:0 0 14px}' +
    '.wd-optin-field label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.6);margin-bottom:6px}' +
    '.wd-optin-field label .wd-optin-opt{color:rgba(255,255,255,0.3);text-transform:none;letter-spacing:normal}' +
    '.wd-optin-field input{width:100%;background:#1A1A1A;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:11px 14px;color:#fff;font-size:15px;font-family:inherit;transition:border-color 0.2s}' +
    '.wd-optin-field input:focus{outline:none;border-color:#C9A277}' +
    '.wd-optin-field input:focus-visible{outline:2px solid #C9A277;outline-offset:2px}' +
    '.wd-optin-checks{display:flex;flex-direction:column;gap:12px;margin:0 0 16px}' +
    '.wd-optin-check{display:flex;align-items:flex-start;gap:10px}' +
    '.wd-optin-check input[type=checkbox]{flex:none;width:18px;height:18px;margin-top:2px;accent-color:#C9A277;cursor:pointer}' +
    '.wd-optin-check input[type=checkbox]:focus-visible{outline:2px solid #C9A277;outline-offset:2px}' +
    '.wd-optin-check label{font-size:14px;line-height:1.55;color:rgba(255,255,255,0.75);cursor:pointer;margin:0}' +
    '.wd-optin-check label a{color:#C9A277;text-decoration:underline;text-underline-offset:2px}' +
    '.wd-optin-btn{background:#A01B4A;color:#fff;border:none;border-radius:9999px;padding:13px 34px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;transition:background 0.3s,transform 0.2s}' +
    '.wd-optin-btn:hover{background:#851437;transform:translateY(-1px)}' +
    '.wd-optin-btn:focus-visible{outline:2px solid #C9A277;outline-offset:3px}' +
    '.wd-optin-btn[disabled]{opacity:0.6;cursor:default;transform:none}' +
    '.wd-optin-status{font-size:14px;line-height:1.55;margin:12px 0 0}' +
    '.wd-optin-status.wd-ok{color:#C9A277}' +
    '.wd-optin-status.wd-err{color:#FF4F8C}' +
    '.wd-optin-compliance{font-size:13px;line-height:1.7;color:rgba(255,255,255,0.5);margin:18px 0 0}' +
    '.wd-optin-compliance a{color:rgba(255,255,255,0.6);text-decoration:underline;text-underline-offset:2px}' +
    '.wd-optin-compliance a:hover{color:#C9A277}' +
    /* footer variant */
    '.wd-optin--footer{padding:48px 24px;border-bottom:1px solid rgba(255,255,255,0.1);background:rgba(201,162,119,0.04)}' +
    '.wd-optin--footer .wd-optin-inner{max-width:1200px;margin:0 auto;display:grid;gap:32px}' +
    '@media(min-width:900px){.wd-optin--footer .wd-optin-inner{grid-template-columns:5fr 7fr;gap:56px;align-items:start}}' +
    '.wd-optin--footer .wd-optin-heading{font-size:1.9rem}' +
    '.wd-optin--footer .wd-optin-sub{font-size:0.95rem}' +
    '@media(min-width:640px){.wd-optin--footer .wd-optin-fields{grid-template-columns:1fr 1fr 1fr}}' +
    /* page variant */
    '.wd-optin--page .wd-optin-heading{font-size:2.6rem}' +
    '@media(min-width:768px){.wd-optin--page .wd-optin-heading{font-size:3.4rem}}' +
    '.wd-optin--page .wd-optin-sub{font-size:1.1rem;max-width:36rem}' +
    '.wd-optin--page .wd-optin-form{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:28px;margin-top:28px}' +
    '@media(min-width:640px){.wd-optin--page .wd-optin-fields{grid-template-columns:1fr 1fr}.wd-optin--page .wd-optin-field--email{grid-column:span 1}}';

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function normalizePhone(raw) {
    var digits = (raw || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
    if (digits.length !== 10) return null;
    return '+1' + digits;
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  var uidCounter = 0;

  function render(root) {
    var variant = root.getAttribute('data-wd-optin') === 'page' ? 'page' : 'footer';
    var uid = 'wdoi' + (++uidCounter);

    var wrap = el('div', { 'class': 'wd-optin wd-optin--' + variant });
    var inner = el('div', { 'class': 'wd-optin-inner' });

    // Heading block
    var headBlock = el('div', {}, [
      el(variant === 'page' ? 'h1' : 'h2', { 'class': 'wd-optin-heading', text: 'Train for an amazing love life.' }),
      el('p', { 'class': 'wd-optin-sub', text: 'Get invited to events and immersions. Tools and tips for love. New podcast episodes. Straight to you.' }),
      el('p', { 'class': 'wd-optin-keyword', html: 'Prefer to text? Text <strong>LOVE</strong> to <strong>833&#8209;407&#8209;0037</strong>.' })
    ]);

    // Form
    var form = el('form', { 'class': 'wd-optin-form', novalidate: 'novalidate' });

    var fields = el('div', { 'class': 'wd-optin-fields' }, [
      el('div', { 'class': 'wd-optin-field' }, [
        el('label', { 'for': uid + '-first', text: 'First name' }),
        el('input', { type: 'text', id: uid + '-first', name: 'first_name', autocomplete: 'given-name', maxlength: '100', required: 'required' })
      ]),
      el('div', { 'class': 'wd-optin-field wd-optin-field--email' }, [
        el('label', { 'for': uid + '-email', text: 'Email' }),
        el('input', { type: 'email', id: uid + '-email', name: 'email', autocomplete: 'email', maxlength: '320', required: 'required' })
      ]),
      el('div', { 'class': 'wd-optin-field' }, [
        el('label', { 'for': uid + '-phone', html: 'Mobile phone <span class="wd-optin-opt">(optional)</span>' }),
        el('input', { type: 'tel', id: uid + '-phone', name: 'phone', autocomplete: 'tel', maxlength: '20', placeholder: '(512) 555-0123' })
      ])
    ]);

    var smsLabelHtml = 'Yes, text me updates from WeDeepen about events, retreats, member sessions, and podcast episodes. Message frequency varies (about 2 to 6 messages per month). Message and data rates may apply. Reply STOP to unsubscribe, HELP for help. Consent is not a condition of purchase. See our <a href="/terms/">Terms of Use</a> and <a href="/privacy/">Privacy Policy</a>.';

    var checks = el('div', { 'class': 'wd-optin-checks' }, [
      el('div', { 'class': 'wd-optin-check' }, [
        el('input', { type: 'checkbox', id: uid + '-email-consent', name: 'email_consent' }),
        el('label', { 'for': uid + '-email-consent', text: EMAIL_CONSENT_TEXT })
      ]),
      el('div', { 'class': 'wd-optin-check' }, [
        el('input', { type: 'checkbox', id: uid + '-sms-consent', name: 'sms_consent' }),
        el('label', { 'for': uid + '-sms-consent', html: smsLabelHtml })
      ])
    ]);

    var btn = el('button', { type: 'submit', 'class': 'wd-optin-btn', text: 'Count me in' });
    var status = el('p', { 'class': 'wd-optin-status', role: 'status', 'aria-live': 'polite' });
    status.style.display = 'none';

    var compliance = el('p', { 'class': 'wd-optin-compliance', html:
      'WeDeepen LLC, 605 W 9th Street, Austin, TX 78701<br>' +
      'Message and data rates may apply. Message frequency varies. Reply STOP to unsubscribe, HELP for help. ' +
      '<a href="/terms/">Terms of Use</a> &middot; <a href="/privacy/">Privacy Policy</a>'
    });

    form.appendChild(fields);
    form.appendChild(checks);
    form.appendChild(btn);
    form.appendChild(status);
    form.appendChild(compliance);

    inner.appendChild(headBlock);
    inner.appendChild(form);
    wrap.appendChild(inner);
    root.appendChild(wrap);

    function showStatus(msg, ok) {
      status.textContent = msg;
      status.className = 'wd-optin-status ' + (ok ? 'wd-ok' : 'wd-err');
      status.style.display = 'block';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.style.display = 'none';

      var firstName = form.first_name.value.trim();
      var email = form.email.value.trim();
      var phoneRaw = form.phone.value.trim();
      var emailConsent = form.email_consent.checked;
      var smsConsent = form.sms_consent.checked;

      if (!firstName) { showStatus('Add your first name and try again.', false); form.first_name.focus(); return; }
      if (!email || !validEmail(email)) { showStatus('That email does not look right. Check it and try again.', false); form.email.focus(); return; }

      var phoneE164 = null;
      if (phoneRaw) {
        phoneE164 = normalizePhone(phoneRaw);
        if (!phoneE164) { showStatus('That phone number does not look right. Use a 10-digit US number.', false); form.phone.focus(); return; }
      }
      if (smsConsent && !phoneE164) {
        showStatus('You checked the box for texts. Add your mobile number so we can reach you.', false);
        form.phone.focus();
        return;
      }

      var payload = {
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        first_name: firstName,
        email: email,
        phone_e164: phoneE164,
        email_consent: emailConsent,
        sms_consent: smsConsent,
        consent_language_version: CONSENT_LANGUAGE_VERSION,
        consent_language_text: smsConsent ? SMS_CONSENT_TEXT : (emailConsent ? EMAIL_CONSENT_TEXT : null),
        source_url: window.location.href
      };

      btn.disabled = true;
      btn.textContent = 'One sec…';

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        btn.textContent = 'Count me in';
        btn.disabled = false;
        var msg = "You're in. Watch your inbox.";
        if (smsConsent) msg += ' And your phone. A confirmation text is on its way.';
        showStatus(msg, true);
      }).catch(function (err) {
        console.error('Opt-in submit failed:', err);
        btn.textContent = 'Count me in';
        btn.disabled = false;
        showStatus('Something went wrong on our end. Text LOVE to 833-407-0037 to join by phone, or email team@wedeepen.com.', false);
      });
    });
  }

  function init() {
    var roots = document.querySelectorAll('[data-wd-optin]');
    if (!roots.length) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    roots.forEach(function (r) { render(r); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
