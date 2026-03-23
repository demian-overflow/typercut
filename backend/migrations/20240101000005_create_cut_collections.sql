-- Cut collections: named groupings of cuts (snippets) derived from ingested materials.
-- Each material belongs to at most one collection; all snippets of a material
-- are implicitly part of that collection.

CREATE TABLE cut_collections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cut_collections_user_id ON cut_collections(user_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER set_cut_collections_updated_at
    BEFORE UPDATE ON cut_collections
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Link materials to a cut collection (optional; NULL means uncollected)
ALTER TABLE materials
    ADD COLUMN cut_collection_id UUID REFERENCES cut_collections(id) ON DELETE SET NULL;

CREATE INDEX idx_materials_cut_collection_id ON materials(cut_collection_id);
