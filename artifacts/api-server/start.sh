#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "[setup] Installing Python dependencies..."
pip install -r requirements.txt --quiet

echo "[setup] Starting Flask server..."
export FLASK_APP=app.py
exec python app.py
