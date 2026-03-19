-- Enable pgvector extension (requires pgvector/pgvector:pg17 image)
CREATE EXTENSION IF NOT EXISTS vector;

-- Concept nodes: semantic units extracted from ingested materials.
-- Each node has an embedding for vector similarity search, which is the
-- baseline for knowledge-graph traversal (find related concepts by proximity).
CREATE TABLE concept_nodes (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id  UUID        REFERENCES materials(id) ON DELETE SET NULL,
    user_id      UUID        REFERENCES users(id)     ON DELETE CASCADE,
    label        TEXT        NOT NULL,               -- short concept name
    description  TEXT        NOT NULL,               -- 1-3 sentence explanation
    level        TEXT        NOT NULL DEFAULT 'intermediate', -- beginner | intermediate | expert
    source_url   TEXT,                               -- GitHub URL if sourced from repo
    embedding    vector(1536),                       -- OpenAI text-embedding-3-small
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_concept_nodes_user_id    ON concept_nodes (user_id);
CREATE INDEX idx_concept_nodes_material   ON concept_nodes (material_id);
-- HNSW index for fast approximate nearest-neighbour search (cosine distance)
CREATE INDEX idx_concept_nodes_embedding  ON concept_nodes
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Edges: typed relationships between concept nodes.
-- Built on top of the vector baseline: start with vector neighbours,
-- then promote confirmed relationships to explicit edges.
CREATE TABLE concept_edges (
    id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    from_id       UUID  NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    to_id         UUID  NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    relation_type TEXT  NOT NULL,  -- 'prerequisite' | 'related' | 'part_of' | 'example_of'
    weight        REAL  NOT NULL DEFAULT 1.0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (from_id, to_id, relation_type)
);

CREATE INDEX idx_concept_edges_from ON concept_edges (from_id);
CREATE INDEX idx_concept_edges_to   ON concept_edges (to_id);
