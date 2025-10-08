# MongoDB Atlas Setup

This backend now uses MongoDB Atlas. Follow these steps to configure it.

## Prerequisites

- MongoDB Atlas cluster (or any MongoDB-compatible deployment)
- Connection string (SRV URI)

## Environment Variables

Required:
- `MONGODB_URI` — MongoDB connection string
- `MONGODB_DB` — Database name (required if not present in URI)

Optional:
- `ADMIN_USERNAME` — Default admin username (defaults to `admin`)
- `ADMIN_PASSWORD_HASH` — Bcrypt hash for admin (defaults to hash of `admin123`)
- `ADMIN_EMAIL` — Admin email address

Example `.env`:

```
MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=hefti_academy
JWT_SECRET=change-me
CORS_ORIGIN=http://localhost:3000
SERVER_PORT=4000
```

## What setup does automatically

- Connects to MongoDB and pings the server
- Creates indexes:
  - `admin.username` unique
  - `members.id` unique
  - `members.academy_id` unique (sparse)
  - `payments` unique composite for monthly: `{ member_id, type, year, month }`
  - `payments` unique composite for registration: `{ member_id, type }`
- Bootstraps an admin user if none exists
- Maintains sequential numeric IDs via a `counters` collection for `admin` and `members`

## Testing

- Run `npm run dev` and visit `/api/test/db-test` to verify connectivity.
- `/api/health` returns database type `MongoDB` when configured.

## Notes

- Member `academy_id` uses `HFA` + zero-padded sequential numeric `id`.
- Payments data mirrors the previous PostgreSQL schema using collections.
