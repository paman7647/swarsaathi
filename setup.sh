#!/bin/bash
# SwarSaathi Unified Startup Script
# Created by Aman Kumar Pandey
# This script runs our FastAPI backend, Nginx server, and the ngrok tunnel concurrently.

echo "=========================================================="
echo " Starting SwarSaathi Multilingual Voice Bot Container "
echo "=========================================================="

# 1. Start the FastAPI backend on port 8000 (running locally on 127.0.0.1)
echo "Launching uvicorn backend on port 8000..."
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# 2. Start the Nginx server on port 80 in the background
echo "Launching Nginx web server on port 80..."
nginx &
NGINX_PID=$!

# 3. Start self-ping loop in the background to prevent Render from idling
if [ "$KEEP_ALIVE" = "true" ] || [ -n "$RENDER_EXTERNAL_URL" ] || [ -n "$PING_URL" ]; then
  URL_TO_PING="${PING_URL:-${RENDER_EXTERNAL_URL:-https://lullaby-follicle-manifesto.ngrok-free.dev/api/health}}"
  echo "Starting background self-ping keep-alive loop for: $URL_TO_PING"
  (
    # Wait 30 seconds for the application to fully start before the first ping
    sleep 30
    while true; do
      echo "Sending self-ping to $URL_TO_PING..."
      curl -s -o /dev/null -w "Self-ping response code: %{http_code}\n" "$URL_TO_PING"
      sleep 600
    done
  ) &
  PING_LOOP_PID=$!
fi

# 4. Handle ngrok tunnel authentication and execution
if [ -n "$NGROK_AUTHTOKEN" ]; then
  echo "Authtoken found. Configuring ngrok credentials..."
  ngrok config add-authtoken "$NGROK_AUTHTOKEN"
  
  echo "Starting secure ngrok tunnel on static domain with pooling..."
  # Run ngrok in the foreground to keep the Docker container active
  ngrok http 80 --url=lullaby-follicle-manifesto.ngrok-free.dev --pooling-enabled
else
  echo "WARNING: NGROK_AUTHTOKEN environment variable is missing."
  echo "Container will run in local-only mode. Exposing local port 80."
  
  # Keep the container running in the foreground by tailing logs
  tail -f /dev/null
fi

# Cleanup background processes if ngrok or script terminates
if [ -n "$PING_LOOP_PID" ]; then
  kill $BACKEND_PID $NGINX_PID $PING_LOOP_PID
else
  kill $BACKEND_PID $NGINX_PID
fi
