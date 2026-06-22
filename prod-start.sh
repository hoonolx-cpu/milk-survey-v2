#!/bin/sh
set -e

# Render injects PORT; server.js listens on that env var
export PORT="${PORT:-3000}"

node server.js


