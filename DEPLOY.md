# Session Master — Deployment Guide for Failsafe

## Overview
Session Master is a SvelteKit (Svelte 5) app with PostgreSQL, running behind a reverse proxy at `session.projectveritos.com`.

## Prerequisites
- Docker and docker-compose on Failsafe
- Reverse proxy (Caddy/nginx) already handling projectveritos.com
- PostgreSQL running (either existing or via Docker)

## Deployment Steps

### 1. Clone the repo
```bash
cd /opt  # or wherever services live
git clone https://github.com/zhebbard/session-master.git
cd session-master
```

### 2. Generate an auth secret
```bash
openssl rand -hex 32
```

### 3. Create `.env.production`
```env
DATABASE_URL=postgres://postgres:YOUR_DB_PASSWORD@localhost:5432/session_master
BETTER_AUTH_URL=https://session.projectveritos.com
BETTER_AUTH_SECRET=<output from step 2>
ORIGIN=https://session.projectveritos.com
```

> **Note:** If PostgreSQL is already running on Failsafe, just create the database:
> ```bash
> psql -U postgres -c "CREATE DATABASE session_master;"
> ```

### 4. Run database migrations
```bash
docker compose run --rm session-master npx drizzle-kit push
```

### 5. Build and start
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The app will be available at `http://localhost:3000`.

### 6. Add reverse proxy route

Add to your Caddy/nginx config (same pattern as projectveritos.com):

**Caddy:**
```
session.projectveritos.com {
    reverse_proxy localhost:3000
}
```

**Nginx:**
```nginx
server {
    server_name session.projectveritos.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 7. Verify
```bash
curl -s -o /dev/null -w "%{http_code}" https://session.projectveritos.com
# Should return 200
```

## Maintenance

### Pull updates
```bash
cd /opt/session-master
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Run migrations after schema changes
```bash
docker compose -f docker-compose.prod.yml exec session-master npx drizzle-kit push
```

### View logs
```bash
docker compose -f docker-compose.prod.yml logs -f session-master
```

### Database backup
```bash
pg_dump session_master > /opt/backups/session_master_$(date +%Y%m%d).sql
```

## Notes
- The app uses Better Auth for authentication (email/password)
- Default user registration is open (no invite code needed to start)
- AI features (LM Studio / z.ai) are configured per-table by the DM — not required for basic functionality
- The adapter is `@sveltejs/adapter-node` — the app runs as a Node.js server, not static files
- Port 3000 is the default; change in `.env.production` if needed
