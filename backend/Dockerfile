FROM rust:1.88-slim-bookworm AS builder

RUN apt-get update \
 && apt-get install -y pkg-config libssl-dev cmake libsasl2-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
# Pre-fetch deps with stub binary for better layer caching
RUN mkdir -p src migrations \
 && echo 'fn main() {}' > src/main.rs \
 && cargo build --release 2>/dev/null || true \
 && rm -rf src

COPY . .
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y libssl3 ca-certificates libsasl2-2 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/lernpunkt-backend /app/lernpunkt-backend
COPY --from=builder /app/migrations /app/migrations

EXPOSE 3001
ENTRYPOINT ["/app/lernpunkt-backend"]
