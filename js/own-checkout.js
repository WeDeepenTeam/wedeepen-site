/**
 * WeDeepen's own checkout: the card form on /checkout/ and the "You're in" page on /checkout/welcome/.
 *
 * People pay first and get their Circle account after. The page talks to the WeDeepen connector on
 * Cloudflare (WeDeepenTeam/wedeepen-google-ads-mcp, src/checkout.ts); card details go from Stripe's
 * own fields straight to Stripe and never touch this site or that server.
 *
 * If the server or Stripe can't be reached, the form is replaced by a button to Circle's checkout,
 * so a visitor can always join.
 */
(function () {
  'use strict';

  var API = 'https://api.wedeepen.com/checkout'; // our own address: some security apps (Norton Safe Web) block *.workers.dev
  // Follow-up emails for people who start but don't finish: the same MailerLite form the old "email first" step used
  // (group "Checkout started (site email step)"; its automation waits an hour and skips anyone who joined). Sent from
  // the browser because MailerLite refuses form posts from Cloudflare Workers. Never blocks the checkout.
  var FOLLOWUP_FORM = 'https://assets.mailerlite.com/jsonp/321715/forms/202397510383175548/subscribe';
  function followUp(email, name) {
    try {
      var b = new URLSearchParams();
      b.append('fields[email]', email);
      b.append('fields[name]', (name || '').trim().split(/\s+/)[0] || '');
      b.append('ml-submit', '1');
      b.append('anticsrf', 'true');
      fetch(FOLLOWUP_FORM, { method: 'POST', mode: 'no-cors', body: b, keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  var CIRCLE = {
    monthly: 'https://circle.wedeepen.com/checkout/wedeepen-club-membership?price_id=368281',
    yearly: 'https://circle.wedeepen.com/checkout/wedeepen-club-membership?price_id=368282'
  };
  var PRICE = { monthly: 99, yearly: 990 };
  var IS_PROD = /(^|\.)wedeepen\.com$/.test(location.hostname);
  var IS_BOT = !!navigator.webdriver || /bot|crawl|spider|facebookexternalhit|meta-external|HeadlessChrome|Lighthouse/i.test(navigator.userAgent);

  var $ = function (id) { return document.getElementById(id); };
  var qs = new URLSearchParams(location.search);

  // Meta's browser cookies, passed to the server so its StartTrial (Conversions API) matches the ad click.
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  function track(ga, meta, params, eventId) {
    if (!IS_PROD || IS_BOT) return;
    try {
      if (ga && typeof window.gtag === 'function') window.gtag('event', ga, params);
      if (meta && typeof window.fbq === 'function') window.fbq('track', meta, { value: params.value, currency: 'USD', content_category: 'membership', content_name: params.plan }, eventId ? { eventID: eventId } : undefined);
    } catch (e) { /* tracking must never break checkout */ }
  }

  function api(path, body) {
    return fetch(API + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, status: res.status, data: data }; }); });
  }

  function longDate(d) {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  // ---------- /checkout/ ----------
  function initForm() {
    var form = $('co-form');
    var plan = (qs.get('plan') === 'yearly' || qs.get('price_id') === '368282') ? 'yearly' : 'monthly';
    var busy = false;
    var stripe, elements;

    function setPlan(p) {
      plan = p;
      $('co-sub').textContent = p === 'yearly'
        ? '$0 today. Then $990/year. Cancel anytime.'
        : '$0 today. Then $99/month. Cancel anytime.';
      $('co-fallback-link').href = CIRCLE[p];
    }
    document.querySelectorAll('input[name="plan"]').forEach(function (r) {
      r.checked = r.value === plan;
      r.addEventListener('change', function () { if (r.checked) setPlan(r.value); });
    });
    setPlan(plan);

    function fallback() {
      form.hidden = true;
      $('co-fallback').hidden = false;
    }
    function alertMsg(html) { $('co-alert').innerHTML = html; if (html) $('co-alert').scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    function fieldErr(name, msg) {
      var input = $('co-' + name), err = $('co-' + name + '-err');
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg || '';
      if (msg && input) input.focus();
    }
    var confirmedEmail = '';
    function showSuggestion(better) {
      var hint = $('co-email-hint');
      if (!hint) return;
      if (!better) { hint.textContent = "We'll send your way into the community to this address."; return; }
      hint.textContent = 'Did you mean ';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = better;
      btn.style.cssText = 'background:none;border:0;padding:0;color:#E8C9A0;text-decoration:underline;cursor:pointer;font:inherit';
      btn.addEventListener('click', function () { $('co-email').value = better; fieldErr('email', ''); showSuggestion(''); });
      hint.appendChild(btn);
      hint.appendChild(document.createTextNode('?'));
    }
    $('co-email').addEventListener('blur', function () { showSuggestion(emailSuggestion($('co-email').value)); });

    // Follow-up emails for everyone who types an email, not only people who get as far as the card: most leave
    // before that. The MailerLite automation waits an hour and skips anyone who started a trial. Sent once per
    // email and name, so editing a typo sends the corrected address.
    var followed = '';
    function followUpEarly() {
      if (!IS_PROD || IS_BOT) return;
      var email = $('co-email').value.trim(), name = $('co-name').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
      if (followed === email + '|' + name) return;
      followed = email + '|' + name;
      followUp(email, name);
    }
    $('co-email').addEventListener('change', followUpEarly);
    $('co-name').addEventListener('change', followUpEarly);
    window.addEventListener('pagehide', followUpEarly);

    // The photo opens the full story (Clarity, Nov 2026: people tapped the photo again and again looking for more).
    // Phone back gesture closes the panel instead of leaving checkout.
    var sell = $('co-sell');
    if (sell) {
      var openedAt = 0;
      var openSell = function () {
        if (!sell.hidden) return;
        sell.hidden = false;
        sell.scrollTop = 0;
        document.body.classList.add('co-sell-on');
        openedAt = Date.now();
        try { history.pushState({ coSell: 1 }, ''); } catch (e) {}
        try { if (typeof window.clarity === 'function') window.clarity('event', 'checkout_story_open'); } catch (e) {}
        track('checkout_story_open', null, { plan: plan });
        $('co-sell-close').focus();
      };
      var closeSell = function (fromHistory) {
        if (sell.hidden) return;
        sell.hidden = true;
        document.body.classList.remove('co-sell-on');
        var v = sell.querySelector('video'); if (v) { try { v.pause(); } catch (e) {} }
        track('checkout_story_close', null, { plan: plan, seconds: Math.round((Date.now() - openedAt) / 1000) });
        if (!fromHistory && history.state && history.state.coSell) { try { history.back(); } catch (e) {} }
      };
      $('co-sell-open').addEventListener('click', openSell);
      $('co-sell-close').addEventListener('click', function () { closeSell(false); $('co-sell-open').focus(); });
      $('co-sell-start').addEventListener('click', function () {
        try { if (typeof window.clarity === 'function') window.clarity('event', 'checkout_story_start'); } catch (e) {}
        track('checkout_story_start', null, { plan: plan });
        closeSell(false);
        var email = $('co-email');
        email.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(function () { try { email.focus({ preventScroll: true }); } catch (e) { email.focus(); } }, 350);
      });
      window.addEventListener('popstate', function () { if (!sell.hidden) closeSell(true); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sell.hidden) closeSell(false); });
    }
    function setBusy(b) {
      busy = b;
      $('co-submit').disabled = b;
      $('co-submit').textContent = b ? 'One moment…' : 'Start my 14 free days';
    }

    $('co-code-toggle').addEventListener('click', function () {
      $('co-code-field').hidden = false;
      this.hidden = true;
      $('co-promo').focus();
    });

    // Keep what the visitor typed. Facebook's and Instagram's in-app browsers often reload the page when someone
    // switches apps (to find their card or check their email), which wiped the form: Clarity showed people pressing
    // Start on an empty form and getting "Enter a valid email address". Stored only in this visitor's own browser,
    // kept 24 hours, cleared once the trial starts. Never the card: Stripe's fields are not ours to read.
    var DRAFT_KEY = 'wd_checkout_draft';
    var DRAFT_FIELDS = ['email', 'name', 'phone', 'promo'];
    var draftDone = false;
    function saveDraft() {
      if (draftDone) return;
      try {
        var d = { t: Date.now(), plan: plan };
        DRAFT_FIELDS.forEach(function (n) { d[n] = $('co-' + n).value; });
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      } catch (e) {}
    }
    function clearDraft() { draftDone = true; try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
    try {
      var saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (saved && Date.now() - saved.t < 86400000) {
        DRAFT_FIELDS.forEach(function (n) {
          var el = $('co-' + n);
          if (el && !el.value && saved[n]) el.value = saved[n];
        });
        if (saved.promo) { $('co-code-field').hidden = false; $('co-code-toggle').hidden = true; }
        // the link they came in on decides the plan; a saved choice only fills in when the link names none
        if (!qs.get('plan') && !qs.get('price_id') && (saved.plan === 'yearly' || saved.plan === 'monthly')) {
          document.querySelectorAll('input[name="plan"]').forEach(function (r) { r.checked = r.value === saved.plan; });
          setPlan(saved.plan);
        }
      } else if (saved) localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    DRAFT_FIELDS.forEach(function (n) { $('co-' + n).addEventListener('input', saveDraft); });
    document.querySelectorAll('input[name="plan"]').forEach(function (r) { r.addEventListener('change', saveDraft); });
    // phones fire pagehide/visibilitychange when the visitor leaves the app; autofill may skip the input event
    window.addEventListener('pagehide', saveDraft);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveDraft(); });

    api('/config').then(function (r) {
      if (!r.ok || !r.data.publishableKey || typeof window.Stripe !== 'function') return fallback();
      var days = r.data.trialDays || 14;
      var first = new Date(Date.now() + days * 86400000);
      document.querySelectorAll('[data-charge-date]').forEach(function (el) { el.textContent = longDate(first); });
      stripe = window.Stripe(r.data.publishableKey);
      elements = stripe.elements({
        mode: 'setup',
        currency: 'usd',
        // Card only, as on Circle's checkout: Apple Pay, Google Pay and Link's saved cards ride on card, and Link's
        // "Bank" tab stays away. Must match the server's list.
        paymentMethodTypes: ['card'],
        fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap' }],
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#C9A277', colorBackground: '#201519', colorText: '#FFFFFF', colorTextSecondary: '#EBDFE3',
            colorTextPlaceholder: '#A8959C', colorDanger: '#FFB3C1', fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSizeBase: '16px', borderRadius: '12px', spacingUnit: '4px'
          },
          rules: { '.Input': { border: '1px solid #6B4A55', boxShadow: 'none' }, '.Tab': { border: '1px solid #6B4A55' } }
        }
      });
      var payment = elements.create('payment', {
        layout: { type: 'tabs' },
        fields: { billingDetails: { name: 'never', email: 'never', phone: 'never' } }
      });
      payment.on('loaderror', fallback);
      payment.mount('#co-payment');
    }).catch(fallback);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy || !stripe) return;
      alertMsg('');
      ['email', 'name', 'phone', 'promo'].forEach(function (n) { fieldErr(n, ''); });

      var email = $('co-email').value.trim();
      var name = $('co-name').value.trim();
      var phone = $('co-phone').value.trim();
      var promo = $('co-promo').value.trim();
      // Clarity (Nov 2026): people tapped Start on an empty form and read "valid email" as a failure, then left.
      if (!email) return fieldErr('email', 'Start with your email.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fieldErr('email', 'Enter a valid email address.');
      var better = emailSuggestion(email);
      if (better && confirmedEmail !== email) {
        confirmedEmail = email; // ask once; pressing Start again keeps what they typed
        showSuggestion(better);
        return fieldErr('email', 'Please check your email: did you mean ' + better + '? Tap it above to fix it, or press Start again to keep yours.');
      }
      if (name.length < 2) return fieldErr('name', 'Enter your first and last name.');
      if (phone.replace(/\D/g, '').length < 10) return fieldErr('phone', 'Enter a mobile number with its area code.');

      setBusy(true);
      track('add_payment_info', null, { plan: plan, value: PRICE[plan], currency: 'USD' });

      var utm = {};
      qs.forEach(function (v, k) { if (/^utm_/.test(k)) utm[k] = v; });

      elements.submit().then(function (r) {
        if (r.error) throw { shown: r.error.message };
        return api('/start', { email: email, name: name, phone: phone, plan: plan, promo: promo || undefined, utm: utm, fbp: cookie('_fbp'), fbc: cookie('_fbc') });
      }).then(function (r) {
        if (r.ok) { followUp(email, name); return r.data; }
        if (r.status === 409) throw { shown: 'It looks like you\'re already a member. <a href="https://circle.wedeepen.com/c/member-s-calendar">Log in here</a>, or write to the team at <a href="mailto:team@wedeepen.com">team@wedeepen.com</a>.' };
        if (r.status === 400 && r.data.field) { fieldErr(r.data.field, r.data.message || 'Please check this.'); throw { shown: '' }; }
        if (r.status === 429) throw { shown: 'That\'s a lot of tries in a short time. Please wait a little and try again.' };
        throw { fallback: true };
      }).then(function (data) {
        return stripe.confirmSetup({
          elements: elements,
          clientSecret: data.clientSecret,
          redirect: 'if_required',
          confirmParams: {
            return_url: location.origin + '/checkout/welcome/?plan=' + plan,
            payment_method_data: { billing_details: { name: name, email: email, phone: phone } }
          }
        });
      }).then(function (r) {
        if (r.error) throw { shown: r.error.message || 'Your card was not accepted. Please try another card.' };
        clearDraft();
        location.href = '/checkout/welcome/?plan=' + plan + '&setup_intent=' + encodeURIComponent(r.setupIntent.id) + '&redirect_status=' + r.setupIntent.status;
      }).catch(function (err) {
        setBusy(false);
        if (err && err.fallback) return fallback();
        if (err && typeof err.shown === 'string') return alertMsg(err.shown);
        alertMsg('Something went wrong on our side and you have not been charged. Please try again, or write to the team at <a href="mailto:team@wedeepen.com">team@wedeepen.com</a>.');
      });
    });
  }

  // ---------- /checkout/welcome/ ----------
  function initWelcome() {
    var id = qs.get('setup_intent') || '';
    var plan = qs.get('plan') === 'yearly' ? 'yearly' : 'monthly';
    function show(which) {
      ['co-w-loading', 'co-w-ok', 'co-w-back', 'co-w-pending', 'co-w-problem'].forEach(function (x) { $(x).hidden = x !== which; });
    }
    if (!/^seti_/.test(id) || (qs.get('redirect_status') && qs.get('redirect_status') !== 'succeeded')) return show('co-w-problem');

    api('/complete', { setup_intent: id }).then(function (r) {
      if (!r.ok) return show('co-w-problem');
      try { localStorage.removeItem('wd_checkout_draft'); } catch (e) {} // the checkout form's saved draft
      if (r.data.firstName) {
        $('co-w-name').textContent = ', ' + r.data.firstName;
        document.querySelectorAll('.co-w-name2').forEach(function (el) { el.textContent = ', ' + r.data.firstName; });
      }
      if (r.data.trialEnd) {
        var d = longDate(new Date(r.data.trialEnd * 1000));
        document.querySelectorAll('.co-w-date').forEach(function (el) { el.textContent = d; });
      }
      document.querySelectorAll('.co-w-price').forEach(function (el) { el.textContent = r.data.plan === 'yearly' ? '$990' : '$99'; });
      // reactivating: their Circle account had been removed; the team reopens it by hand (Circle's API can't).
      show(r.data.reactivating ? 'co-w-back' : r.data.access ? 'co-w-ok' : 'co-w-pending');
      var key = 'wd-trial-' + id;
      var seen = false;
      try { seen = !!sessionStorage.getItem(key); sessionStorage.setItem(key, '1'); } catch (e) { /* private mode */ }
      // Same event id as the server's Conversions API event, so Meta counts the trial once.
      if (!seen) track('start_trial', 'StartTrial', { plan: r.data.plan || plan, value: PRICE[r.data.plan || plan], currency: 'USD' }, 'trial_' + id);
    }).catch(function () { show('co-w-problem'); });
  }


  // Common email-domain typos (gmial.com, hotmial.com, .con ...). A mistyped address means the person pays but never
  // gets the invitation, so we suggest the likely fix and ask once before submitting.
  var DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com', 'msn.com', 'me.com', 'mac.com', 'comcast.net', 'protonmail.com', 'proton.me', 'mail.com', 'gmx.com', 'hey.com', 'att.net', 'verizon.net', 'sbcglobal.net', 'ymail.com'];
  function editDistance(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) d[i] = [i];
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function emailSuggestion(email) {
    var m = /^([^\s@]+)@([^\s@]+)$/.exec((email || '').trim().toLowerCase());
    if (!m) return '';
    var domain = m[2].replace(/\.(con|cmo|ocm|vom|comm|om)$/, '.com');
    if (DOMAINS.indexOf(m[2]) >= 0) return '';
    var best = '', bestD = 3;
    DOMAINS.forEach(function (d) { var x = editDistance(domain, d); if (x < bestD) { bestD = x; best = d; } });
    if (!best && domain !== m[2] && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) best = domain; // only the .con -> .com fix
    if (!best || best === m[2]) return '';
    return m[1] + '@' + best;
  }

  if ($('co-form')) initForm();
  if ($('co-w-loading')) initWelcome();
})();
