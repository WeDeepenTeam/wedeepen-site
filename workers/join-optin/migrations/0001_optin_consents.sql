-- One row per /join/ form submission: the proof of consent behind the
-- toll-free texting number (833-407-0037). Exact consent wording and its
-- version are kept with each row.
CREATE TABLE IF NOT EXISTS optin_consents (
  id                        TEXT PRIMARY KEY,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  first_name                TEXT NOT NULL,
  email                     TEXT NOT NULL,
  phone_e164                TEXT,
  email_consent             INTEGER NOT NULL DEFAULT 0,
  sms_consent               INTEGER NOT NULL DEFAULT 0,
  consent_language_version  TEXT,
  consent_language_text     TEXT,
  source_url                TEXT,
  user_agent                TEXT,
  client_timestamp          TEXT,
  ip_address                TEXT,
  country                   TEXT,
  mailerlite_status         TEXT,
  simpletexting_status      TEXT
);
CREATE INDEX IF NOT EXISTS optin_consents_email_idx ON optin_consents (email);
CREATE INDEX IF NOT EXISTS optin_consents_phone_idx ON optin_consents (phone_e164);
CREATE INDEX IF NOT EXISTS optin_consents_created_idx ON optin_consents (created_at);
