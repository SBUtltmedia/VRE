#!/bin/zsh

# Path to Chrome Canary
CHROME_CANARY="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"

# Temporary profile directory (cleared on reboot usually, or you can delete manually)
USER_DATA_DIR="/tmp/chrome-canary-debug-profile"

# URL to open (defaulting to your visemes page)
TARGET_URL="http://127.0.0.1:5502/visemes.html"

echo "Launching Chrome Canary for debugging..."
echo "  - Port: 9222"
echo "  - Profile: $USER_DATA_DIR (Isolated)"
echo "  - URL: $TARGET_URL"

"$CHROME_CANARY" \
  --remote-debugging-port=9222 \
  --user-data-dir="$USER_DATA_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "$TARGET_URL"
