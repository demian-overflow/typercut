CREATE TABLE materials (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT        NOT NULL,
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_materials_user_id ON materials (user_id);

CREATE TRIGGER materials_updated_at
    BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE snippets (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID        NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text        TEXT        NOT NULL,
    word_count  INTEGER     NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snippets_material_id ON snippets (material_id);
CREATE INDEX idx_snippets_user_id     ON snippets (user_id);
