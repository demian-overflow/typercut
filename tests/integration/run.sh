#!/usr/bin/env bash
set -e

IMAGE="registry.noogoo.ch/orderout/nightglow:latest"
PORT=7000
URL="${1:-https://example.com}"

echo "Pulling nightglow..."
docker pull "$IMAGE" -q

echo "Starting nightglow..."
docker rm -f ng 2>/dev/null || true
docker run -d --name ng -p $PORT:$PORT "$IMAGE" \
    --headless --webdriver $PORT about:blank

echo "Running scrape: $URL"
python3 "$(dirname "$0")/scrape.py" "$URL"

docker rm -f ng 2>/dev/null || true
