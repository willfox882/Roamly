-- ============================================================
-- NomadVault — DB migrations
-- Postgres-flavored DDL. SQLite-compat blocks marked --SQLITE:
-- NEVER edit a shipped block. Add new numbered migrations only.
-- ============================================================

-- MIGRATION 001_initial —————————————————————————————————————

-- Postgres:
CREATE TABLE IF NOT EXISTS users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        UNIQUE NOT NULL,
  name        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trips (
  id               uuid        PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  timezone         text        NOT NULL,
  notes            text,
  data_version     integer     NOT NULL DEFAULT 1,
  origin           text        NOT NULL DEFAULT 'local',
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_modified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trips_user_id_start_date ON trips(user_id, start_date);
CREATE INDEX IF NOT EXISTS trips_last_modified_at   ON trips(last_modified_at);

CREATE TABLE IF NOT EXISTS events (
  id                  uuid        PRIMARY KEY,
  trip_id             uuid        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL,
  type                text        NOT NULL CHECK (type IN ('flight','hotel','excursion','transport','reservation','other')),
  start_datetime      timestamptz,
  end_datetime        timestamptz,
  timezone            text,
  location_name       text,
  lat                 double precision,
  lng                 double precision,
  provider            text,
  confirmation_number text,        -- stored as ciphertext on server
  pnr                 text,        -- stored as ciphertext on server
  raw_source_json     text,        -- stored as ciphertext on server
  parsed_json         jsonb,
  confidence          real        NOT NULL DEFAULT 0.5,
  status              text        NOT NULL DEFAULT 'needs_review'
                                  CHECK (status IN ('confirmed','tentative','needs_review','cancelled')),
  origin              text        NOT NULL DEFAULT 'local',
  data_version        integer     NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_modified_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_trip_id              ON events(trip_id);
CREATE INDEX IF NOT EXISTS events_user_id_modified     ON events(user_id, last_modified_at);
CREATE INDEX IF NOT EXISTS events_start_datetime       ON events(start_datetime);

CREATE TABLE IF NOT EXISTS bucket_pins (
  id               uuid        PRIMARY KEY,
  user_id          uuid        NOT NULL,
  name             text        NOT NULL,
  lat              double precision NOT NULL,
  lng              double precision NOT NULL,
  country          text,
  priority         smallint    NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)),
  completed        boolean     NOT NULL DEFAULT false,
  completed_date   date,
  notes            text,
  origin           text        NOT NULL DEFAULT 'local',
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_modified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bucket_pins_user_id ON bucket_pins(user_id);

CREATE TABLE IF NOT EXISTS exclusions (
  id               uuid        PRIMARY KEY,
  user_id          uuid        NOT NULL,
  place_name       text        NOT NULL,
  lat              double precision,
  lng              double precision,
  country          text,
  reason           text,
  origin           text        NOT NULL DEFAULT 'local',
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_modified_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachments (
  id          uuid  PRIMARY KEY,
  event_id    uuid  NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  blob_key    text  NOT NULL,
  mime_type   text  NOT NULL,
  size        bigint NOT NULL,
  sha256      text  NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS changelog (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type  text        NOT NULL,
  record_id    uuid        NOT NULL,
  op           text        NOT NULL CHECK (op IN ('create','update','delete')),
  ts           timestamptz NOT NULL DEFAULT now(),
  origin       text        NOT NULL DEFAULT 'local',
  user_id      uuid
);

CREATE INDEX IF NOT EXISTS changelog_record_id ON changelog(record_id);
CREATE INDEX IF NOT EXISTS changelog_ts        ON changelog(ts);

CREATE TABLE IF NOT EXISTS backups_meta (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  size         bigint      NOT NULL,
  sha256       text        NOT NULL,
  encrypted    boolean     NOT NULL DEFAULT true,
  destination  text        NOT NULL,
  remote_ref   text
);

-- MIGRATION 001_initial END ————————————————————————————————

-- --SQLITE: compat version (used by server/db/sqlite.ts)
--
-- CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text UNIQUE NOT NULL, name text, created_at text NOT NULL DEFAULT (datetime('now')));
-- CREATE TABLE IF NOT EXISTS trips (id text PRIMARY KEY, user_id text NOT NULL, title text NOT NULL, start_date text NOT NULL, end_date text NOT NULL, timezone text NOT NULL, notes text, data_version integer NOT NULL DEFAULT 1, origin text NOT NULL DEFAULT 'local', created_at text NOT NULL DEFAULT (datetime('now')), last_modified_at text NOT NULL DEFAULT (datetime('now')));
-- CREATE TABLE IF NOT EXISTS events (id text PRIMARY KEY, trip_id text NOT NULL, user_id text NOT NULL, type text NOT NULL, start_datetime text, end_datetime text, timezone text, location_name text, lat real, lng real, provider text, confirmation_number text, pnr text, raw_source_json text, parsed_json text, confidence real NOT NULL DEFAULT 0.5, status text NOT NULL DEFAULT 'needs_review', origin text NOT NULL DEFAULT 'local', data_version integer NOT NULL DEFAULT 1, created_at text NOT NULL DEFAULT (datetime('now')), last_modified_at text NOT NULL DEFAULT (datetime('now')));
-- CREATE TABLE IF NOT EXISTS bucket_pins (id text PRIMARY KEY, user_id text NOT NULL, name text NOT NULL, lat real NOT NULL, lng real NOT NULL, country text, priority integer NOT NULL DEFAULT 2, completed integer NOT NULL DEFAULT 0, completed_date text, notes text, origin text NOT NULL DEFAULT 'local', created_at text NOT NULL DEFAULT (datetime('now')), last_modified_at text NOT NULL DEFAULT (datetime('now')));
-- CREATE TABLE IF NOT EXISTS exclusions (id text PRIMARY KEY, user_id text NOT NULL, place_name text NOT NULL, lat real, lng real, country text, reason text, origin text NOT NULL DEFAULT 'local', created_at text NOT NULL DEFAULT (datetime('now')), last_modified_at text NOT NULL DEFAULT (datetime('now')));
-- CREATE TABLE IF NOT EXISTS attachments (id text PRIMARY KEY, event_id text NOT NULL, blob_key text NOT NULL, mime_type text NOT NULL, size integer NOT NULL, sha256 text NOT NULL, created_at text NOT NULL DEFAULT (datetime('now')));
-- CREATE TABLE IF NOT EXISTS changelog (id text PRIMARY KEY, record_type text NOT NULL, record_id text NOT NULL, op text NOT NULL, ts text NOT NULL DEFAULT (datetime('now')), origin text NOT NULL DEFAULT 'local', user_id text);
-- CREATE TABLE IF NOT EXISTS backups_meta (id text PRIMARY KEY, user_id text NOT NULL, created_at text NOT NULL DEFAULT (datetime('now')), size integer NOT NULL, sha256 text NOT NULL, encrypted integer NOT NULL DEFAULT 1, destination text NOT NULL, remote_ref text);
