# Deployment Guide

## 1. Prerequisites

- Node.js 20+
- MongoDB Atlas cluster or a running MongoDB service
- A valid Angel One API setup
- A real SMS provider for OTP delivery
- A hosting provider such as Render, Railway, Fly.io, or a VPS

## 2. Environment variables

Create a production `.env` file using the template at `.env.example`.

```bash
cp .env.example .env
```

Then populate the values with your actual deployment secrets.

## 3. Local backend run

```bash
cd ledgerview-backend
npm install
npm start
```

## 4. Static frontend hosting

The frontend is a static HTML file. You can serve it through any static host or reverse proxy.

Example:

```bash
cd /workspaces/platform
python3 -m http.server 8000
```

## 5. Docker workflow

This repo includes a Dockerfile and docker-compose.yml. Build it with:

```bash
docker compose up --build
```

## 6. Production deployment checklist

- set all required env vars in the secrets manager
- confirm Atlas network access is allowed
- set `CORS_ORIGIN` to your live frontend URL
- verify the frontend can reach the backend over HTTPS
- verify that OTP delivery works with a real SMS provider
- confirm the Angel One credentials are valid
- approve the security policy and rate-limits before public launch

## 7. Recommended architecture

- Frontend: static host / CDN
- Backend: Node.js app on a private runtime or container
- Database: MongoDB Atlas
- Messaging: Twilio or equivalent SMS provider
- Secrets: environment manager / secret store

## 8. Health checks

- Backend health: `GET /api/health`
- Frontend: static page should respond with `200` and the UI HTML
- MongoDB: confirm a successful DB connection in logs
