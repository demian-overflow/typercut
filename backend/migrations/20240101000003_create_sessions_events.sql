-- Sessions: one row per typing attempt
CREATE TABLE sessions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snippet_id          UUID        REFERENCES snippets(id) ON DELETE SET NULL,
    -- snapshot of the text at the time of the session (snippet may be deleted later)
    text                TEXT        NOT NULL,
    source              TEXT        NOT NULL DEFAULT 'snippet', -- 'snippet' | 'generated' | 'manual'
    status              TEXT        NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed' | 'abandoned'
    -- stats (populated on completion)
    wpm                 NUMERIC,
    accuracy            NUMERIC,
    duration_seconds    NUMERIC,
    total_keystrokes    INTEGER,
    correct_keystrokes  INTEGER,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id    ON sessions (user_id);
CREATE INDEX idx_sessions_snippet_id ON sessions (snippet_id);
CREATE INDEX idx_sessions_status     ON sessions (status);
CREATE INDEX idx_sessions_started_at ON sessions (started_at DESC);

-- Keystroke-level data for error pattern analysis
CREATE TABLE session_keystrokes (
    id           BIGSERIAL   PRIMARY KEY,
    session_id   UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    position     INTEGER     NOT NULL, -- char index in text
    expected     TEXT        NOT NULL,
    typed        TEXT,                 -- NULL means backspace
    is_correct   BOOLEAN     NOT NULL,
    elapsed_ms   INTEGER     NOT NULL, -- ms since session started_at
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_keystrokes_session_id ON session_keystrokes (session_id);

-- Text generations: track AI-generated typing texts
CREATE TABLE text_generations (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic        TEXT        NOT NULL,
    style        TEXT        NOT NULL DEFAULT 'prose', -- 'prose' | 'quotes' | 'code'
    length       TEXT        NOT NULL DEFAULT 'medium', -- 'short' | 'medium' | 'long'
    generated_text TEXT      NOT NULL,
    model        TEXT        NOT NULL,
    tokens_used  INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_text_generations_user_id ON text_generations (user_id);

-- Events: append-only warehouse feed
-- Nothing is ever updated or deleted here.
CREATE TABLE events (
    id           BIGSERIAL   PRIMARY KEY,
    event_id     UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_type   TEXT        NOT NULL,
    user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
    entity_type  TEXT,                 -- 'material' | 'session' | 'snippet' | 'user' | ...
    entity_id    UUID,
    payload      JSONB       NOT NULL DEFAULT '{}',
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_event_type  ON events (event_type);
CREATE INDEX idx_events_user_id     ON events (user_id);
CREATE INDEX idx_events_occurred_at ON events (occurred_at DESC);
CREATE INDEX idx_events_entity      ON events (entity_type, entity_id);
-- GIN index for payload queries
CREATE INDEX idx_events_payload     ON events USING GIN (payload);
