-- =============================================
-- OPT-IN CONSENT RECORDS (wedeepen.com/join/)
-- Migration: 20261111_optin_consents
--
-- One row per /join/ form submission, written by the Edge Function
-- join-optin (WeDeepenTeam/my-app supabase/functions/join-optin). Keeps the
-- exact consent wording and version each person agreed to: the proof of
-- consent for the toll-free texting number (833-407-0037).
-- Personal data: readable only with the service role (RLS on, no policies).
-- =============================================

CREATE TABLE IF NOT EXISTS optin_consents (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_name                TEXT NOT NULL,
  email                     TEXT NOT NULL,
  phone_e164                TEXT,
  email_consent             BOOLEAN NOT NULL DEFAULT FALSE,
  sms_consent               BOOLEAN NOT NULL DEFAULT FALSE,
  consent_language_version  TEXT,
  consent_language_text     TEXT,
  source_url                TEXT,
  user_agent                TEXT,
  client_timestamp          TEXT,
  ip_address                TEXT,
  mailerlite_status         TEXT,
  simpletexting_status      TEXT
);

CREATE INDEX IF NOT EXISTS optin_consents_email_idx ON optin_consents (email);
CREATE INDEX IF NOT EXISTS optin_consents_phone_idx ON optin_consents (phone_e164);
CREATE INDEX IF NOT EXISTS optin_consents_created_idx ON optin_consents (created_at DESC);

ALTER TABLE optin_consents ENABLE ROW LEVEL SECURITY;
-- No policies: the anon key can't read or write. The Edge Function uses the
-- service role, which bypasses RLS.
