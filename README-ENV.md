# Environment Variables Configuration

This document explains the environment variables used by the Hefti Academy server application.

## Required Environment Variables

### Database Configuration
- `DATABASE_URL` - PostgreSQL connection string (required for PostgreSQL deployment)

### Security
- `JWT_SECRET` - Secret key for JWT token signing (required)
  - Generate a strong random string for production
  - Example: `JWT_SECRET=my-super-secret-jwt-key-12345`

### CORS Configuration
- `CORS_ORIGIN` - Allowed origin for CORS requests (required for web frontend)
  - Example: `CORS_ORIGIN=https://your-frontend.vercel.app`

## Optional Environment Variables

### Server Configuration
- `SERVER_PORT` - Port for local development (defaults to 4000)
  - Example: `SERVER_PORT=3001`

### Admin User Configuration
- `ADMIN_USERNAME` - Default admin username (defaults to 'admin')
  - Example: `ADMIN_USERNAME=myadmin`
- `ADMIN_PASSWORD_HASH` - Hashed password for admin (defaults to bcrypt hash of 'admin123')
  - Generate using the hash-password script: `npm run hash`
- `ADMIN_EMAIL` - Admin email address
  - Example: `ADMIN_EMAIL=admin@example.com`

### Application Settings
- `INST_NAME_AR` - Institution name in Arabic (defaults to 'أكاديمية هفتي لكرة القدم')
  - Example: `INST_NAME_AR=أكاديمية الرياضة النموذجية`
- `INST_NAME_EN` - Institution name in English (defaults to 'Hefti Academy')
  - Example: `INST_NAME_EN=Model Sports Academy`
- `ENABLE_PUBLIC_MEMBER_CARD` - Enable public member card access (defaults to 'false')
  - Example: `ENABLE_PUBLIC_MEMBER_CARD=true`
- `BASE_URL` - Base URL for the application (used for QR codes, etc.)
  - Example: `BASE_URL=https://your-app.vercel.app`

## Vercel-Specific Environment Variables

When deploying to Vercel, you can set these in the Vercel dashboard:

1. Go to your project settings in Vercel
2. Navigate to the "Environment Variables" section
3. Add each variable with its value

For sensitive variables like `DATABASE_URL` and `JWT_SECRET`, mark them as "Production" only.

## Local Development (.env file)

For local development, create a `.env` file in the server directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/hefti_academy
JWT_SECRET=my-dev-secret-key-change-me
CORS_ORIGIN=http://localhost:3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2a$10$example_hash_here
SERVER_PORT=4000
```

## Generating Password Hashes

To generate a password hash for the admin user:

```bash
npm run hash
```

This will prompt you to enter a password and will output the bcrypt hash that you can use for `ADMIN_PASSWORD_HASH`.

## Security Best Practices

1. Never commit environment variables to version control
2. Use strong, randomly generated values for secrets
3. Rotate secrets regularly
4. Use different values for development and production
5. Restrict database permissions to only what's needed