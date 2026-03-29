FROM lukemathwalker/cargo-chef:latest-rust-1-slim-bookworm AS chef
WORKDIR /app

# ── Plan ──────────────────────────────────────────────────────────────────────
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# ── Build deps (cached as long as Cargo.toml/Cargo.lock unchanged) ────────────
FROM chef AS builder
RUN apt-get update \
 && apt-get install -y pkg-config libssl-dev cmake libsasl2-dev g++ libcurl4-openssl-dev \
 && rm -rf /var/lib/apt/lists/*
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# ── Build application ─────────────────────────────────────────────────────────
COPY . .
RUN cargo build --release

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM debian:trixie-slim AS runtime
RUN apt-get update \
 && apt-get install -y libssl3 ca-certificates libsasl2-2 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/typercut-backend /app/typercut-backend
COPY --from=builder /app/migrations /app/migrations

EXPOSE 3001
ENTRYPOINT ["/app/typercut-backend"]
