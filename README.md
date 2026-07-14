# Techerudite Scheduler

A lightweight scheduling system with authentication, availability management, public booking links, PostgreSQL/Prisma persistence, and Redis-backed link caching.

## Project Structure

- `backend/` - Express API, Prisma schema, Redis integration, and TypeScript server code
- `frontend/` - React + Vite client written in TypeScript

## Prerequisites

- Node.js 18+ recommended
- PostgreSQL running locally or remotely
- Redis running locally or remotely

## Backend Setup

1. Open a terminal in `backend/`.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file from `.env.example` and set your values:

```env
PORT=5000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
JWT_ACCESS_SECRET=your-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
REDIS_URL=redis://localhost:6379
PUBLIC_APP_URL=http://localhost:5173
```

4. Generate Prisma client and apply migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Start the backend in development mode:

```bash
npm run dev
```

6. Build the backend for production:

```bash
npm run build
npm start
```

## Frontend Setup

1. Open a terminal in `frontend/`.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file if you want to override the API URL:

```env
VITE_API_URL=http://localhost:5000
```

4. Start the frontend in development mode:

```bash
npm run dev
```

5. Build the frontend for production:

```bash
npm run build
npm run preview
```

## Running The App

1. Start PostgreSQL and Redis.
2. Start the backend from `backend/`.
3. Start the frontend from `frontend/`.
4. Open the frontend URL shown by Vite, usually `http://localhost:5173`.

## Main Features

- Register and log in with JWT auth
- Save availability slots for a selected date and time range
- Generate a public booking link
- View future dates and available 30-minute slots on the public page
- Prevent already-booked slots from showing again for the same link
- Return a 404 state for invalid public booking links

## Notes

- The frontend keeps the newly saved availability list in local React state, so it disappears on refresh as requested.
- Prisma is used because PostgreSQL fits the relational booking and conflict rules better than MongoDB for this task.
- Redis is used as a cache for booking link lookups.
