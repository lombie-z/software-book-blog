#!/usr/bin/env bash
# CI build script: starts a local TinaCMS dev server so next build can
# fetch content from localhost:4001 without needing Tina Cloud secrets.
set -euo pipefail

echo "::group::Starting local TinaCMS server"
# Start tina dev server in background (serves GraphQL at localhost:4001).
# No child command (-c) — we only need the data layer.
npx tinacms dev &
TINA_PID=$!

# Wait for the GraphQL endpoint to come up (up to 120 s).
npx wait-on http://localhost:4001/graphql --timeout 120000
echo "TinaCMS local server ready (PID $TINA_PID)"
echo "::endgroup::"

echo "::group::Running next build"
npx next build
echo "::endgroup::"

# Clean up
kill $TINA_PID 2>/dev/null || true
