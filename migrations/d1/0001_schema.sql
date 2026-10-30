-- The Conspiracy Atlas – D1 schema
-- D1 enforces foreign keys by default. All statements are idempotent-safe for a fresh database.

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Public author identities. Only a freely chosen display name is stored, never e-mail or IP addresses.
CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE theories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  summary TEXT NOT NULL,
  background TEXT,
  origin_story TEXT,
  body_json TEXT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  evidence_status TEXT NOT NULL CHECK (evidence_status IN ('historically_documented','supported_by_evidence','partially_supported','disputed','unverified','debunked','under_investigation')),
  image_path TEXT,
  image_credit TEXT,
  author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
  origin TEXT NOT NULL DEFAULT 'editorial' CHECK (origin IN ('editorial', 'community')),
  content_language TEXT NOT NULL DEFAULT 'en',
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_theories_pub_updated ON theories(is_published, updated_at DESC);
CREATE INDEX idx_theories_category ON theories(category_id, is_published, title);
CREATE INDEX idx_theories_status ON theories(evidence_status, is_published);
CREATE INDEX idx_theories_origin ON theories(origin, is_published, updated_at DESC);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE theory_tags (
  theory_id INTEGER NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (theory_id, tag_id)
);
CREATE INDEX idx_theory_tags_tag ON theory_tags(tag_id);

CREATE TABLE claims (
  id INTEGER PRIMARY KEY,
  theory_id INTEGER NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  evidence_status TEXT NOT NULL CHECK (evidence_status IN ('historically_documented','supported_by_evidence','partially_supported','disputed','unverified','debunked','under_investigation')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_claims_theory ON claims(theory_id, position);

CREATE TABLE counter_arguments (
  id INTEGER PRIMARY KEY,
  theory_id INTEGER NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  claim_id INTEGER REFERENCES claims(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_counter_theory ON counter_arguments(theory_id, position);

CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  publisher TEXT,
  author TEXT,
  published_date TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('primary_document','government_report','court_record','academic_paper','book','news_article','reference_work','archive_collection','website','other')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  url TEXT,
  last_checked TEXT,
  quality_note TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sources_primary ON sources(is_primary, title);

-- Evidence links a source to exactly the claim / counter-argument it backs.
-- A source never automatically counts as proof for every claim of a theory.
CREATE TABLE evidence (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  theory_id INTEGER NOT NULL REFERENCES theories(id) ON DELETE CASCADE,
  claim_id INTEGER REFERENCES claims(id) ON DELETE CASCADE,
  counter_argument_id INTEGER REFERENCES counter_arguments(id) ON DELETE CASCADE,
  relation TEXT NOT NULL CHECK (relation IN ('supports','refutes','context','documents')),
  note TEXT,
  CHECK (claim_id IS NULL OR counter_argument_id IS NULL)
);
CREATE INDEX idx_evidence_theory ON evidence(theory_id);
CREATE INDEX idx_evidence_claim ON evidence(claim_id);
CREATE INDEX idx_evidence_counter ON evidence(counter_argument_id);
CREATE INDEX idx_evidence_source ON evidence(source_id);

CREATE TABLE locations (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country_code TEXT,
  lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  region_kind TEXT NOT NULL DEFAULT 'site' CHECK (region_kind IN ('site','city','region','country')),
  description TEXT
);

CREATE TABLE organizations (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'organization' CHECK (kind IN ('organization','institution','agency','company','group','commission')),
  description TEXT,
  founded TEXT,
  country TEXT,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL
);
CREATE INDEX idx_organizations_name ON organizations(name);

CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT,
  description TEXT,
  born TEXT,
  died TEXT
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  start_year INTEGER NOT NULL,
  end_year INTEGER,
  is_period INTEGER NOT NULL DEFAULT 0 CHECK (is_period IN (0, 1)),
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  evidence_status TEXT NOT NULL DEFAULT 'historically_documented' CHECK (evidence_status IN ('historically_documented','supported_by_evidence','partially_supported','disputed','unverified','debunked','under_investigation'))
);
CREATE INDEX idx_events_year ON events(start_year, end_year);
CREATE INDEX idx_events_location ON events(location_id);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL DEFAULT 'document',
  url TEXT,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  published_date TEXT,
  archive_name TEXT,
  license_note TEXT
);

-- Polymorphic connections between archive entities.
CREATE TABLE relationships (
  id INTEGER PRIMARY KEY,
  from_type TEXT NOT NULL CHECK (from_type IN ('theory','event','organization','person','location','document','source','claim')),
  from_id INTEGER NOT NULL,
  to_type TEXT NOT NULL CHECK (to_type IN ('theory','event','organization','person','location','document','source','claim')),
  to_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('documented','claimed','thematic','temporal','unresolved','counter')),
  verification TEXT NOT NULL DEFAULT 'suggested' CHECK (verification IN ('documented','suggested')),
  label TEXT,
  note TEXT,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (from_type, from_id, to_type, to_id, kind)
);
CREATE INDEX idx_rel_from ON relationships(from_type, from_id);
CREATE INDEX idx_rel_to ON relationships(to_type, to_id);

CREATE TABLE investigations (
  id INTEGER PRIMARY KEY,
  owner_key_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_investigations_owner ON investigations(owner_key_hash, updated_at DESC);

CREATE TABLE investigation_notes (
  id INTEGER PRIMARY KEY,
  investigation_id INTEGER NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('note','hypothesis','source','counter_argument','document_link','timeline_entry')),
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  event_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_inv_notes ON investigation_notes(investigation_id, created_at);

CREATE TABLE boards (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  investigation_id INTEGER REFERENCES investigations(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_boards_investigation ON boards(investigation_id);

-- Cards on a board. Display fields are denormalised so a wall loads with two indexed queries.
CREATE TABLE board_nodes (
  id INTEGER PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  entity_type TEXT CHECK (entity_type IN ('theory','event','organization','person','location','document','source','claim')),
  entity_id INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('theory','event','organization','person','institution','location','document','technology','claim','source')),
  title TEXT NOT NULL,
  summary TEXT,
  category_slug TEXT,
  evidence_status TEXT,
  image_path TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  group_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_board_nodes_board ON board_nodes(board_id);
CREATE INDEX idx_board_nodes_entity ON board_nodes(entity_type, entity_id);

CREATE TABLE board_positions (
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES board_nodes(id) ON DELETE CASCADE,
  x REAL NOT NULL,
  y REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (board_id, node_id)
);

-- Red threads drawn on a board.
CREATE TABLE board_edges (
  id INTEGER PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  source_node_id INTEGER NOT NULL REFERENCES board_nodes(id) ON DELETE CASCADE,
  target_node_id INTEGER NOT NULL REFERENCES board_nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('documented','claimed','thematic','temporal','unresolved','counter')),
  verification TEXT NOT NULL DEFAULT 'suggested' CHECK (verification IN ('documented','suggested')),
  label TEXT,
  relationship_id INTEGER REFERENCES relationships(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (board_id, source_node_id, target_node_id, kind)
);
CREATE INDEX idx_board_edges_board ON board_edges(board_id);

CREATE TABLE community_submissions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  summary TEXT NOT NULL,
  body_json TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  tags_json TEXT NOT NULL DEFAULT '[]',
  sources_json TEXT NOT NULL DEFAULT '[]',
  document_links_json TEXT NOT NULL DEFAULT '[]',
  counter_arguments_json TEXT NOT NULL DEFAULT '[]',
  related_events_json TEXT NOT NULL DEFAULT '[]',
  related_theory_ids_json TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','de')),
  author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
  display_mode TEXT NOT NULL CHECK (display_mode IN ('named','anonymous')),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('draft','pending_review','changes_requested','approved','rejected','published','withdrawn')),
  moderator_note TEXT,
  published_theory_id INTEGER REFERENCES theories(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_submissions_status ON community_submissions(status, created_at DESC);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('theory','submission','event','organization','source')),
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('misinformation','missing_source','copyright','harassment','spam','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX idx_reports_status ON reports(status, created_at DESC);

CREATE TABLE moderation_actions (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER REFERENCES community_submissions(id) ON DELETE CASCADE,
  report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  note TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_moderation_submission ON moderation_actions(submission_id, created_at);

-- Multilingual content. English lives in the main tables; other locales are stored here.
CREATE TABLE translations (
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id, locale, field)
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Admin sessions: only a SHA-256 hash of the session token is stored.
CREATE TABLE admin_sessions (
  id_hash TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_admin_sessions_expiry ON admin_sessions(expires_at);

-- Short-lived rate limit counters. Keys are salted hashes, never raw IP addresses, and are purged regularly.
CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key_hash, window_start)
);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
