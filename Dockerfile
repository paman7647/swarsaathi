# ==========================================
# SwarSaathi Unified Single-Container Build
# Built by Aman Kumar Pandey
# Combines React (Vite), FastAPI, Nginx, and ngrok
# ==========================================

# Step 1: Build the React Frontend
FROM node:22-alpine AS frontend-build
WORKDIR /ui
COPY web/package*.json ./
RUN npm install
COPY web/ .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Step 2: Final Runtime Image (Python + Nginx + ngrok)
FROM python:3.12-slim

# Install system dependencies (Nginx, curl, and ngrok)
RUN apt-get update && apt-get install -y nginx curl gnupg && \
    curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
    echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | tee /etc/apt/sources.list.d/ngrok.list && \
    apt-get update && apt-get install -y ngrok && \
    apt-get clean

# Copy custom Nginx proxy settings
COPY nginx_unified.conf /etc/nginx/sites-available/default
RUN rm -f /etc/nginx/sites-enabled/default && ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/

# Set up backend code
WORKDIR /service
COPY core/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY core/app ./app
RUN mkdir -p /service/data

# Copy frontend build bundle to Nginx standard serving directory
COPY --from=frontend-build /ui/dist /var/www/html

# Copy the unified setup startup script
COPY setup.sh /setup.sh
RUN chmod +x /setup.sh

# Expose HTTP port 80
EXPOSE 80

# Execute startup routine
ENTRYPOINT ["/setup.sh"]
