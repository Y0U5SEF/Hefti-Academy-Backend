# Deploying to Vercel

This document provides instructions for deploying the Hefti Academy server to Vercel.

## Prerequisites

1. A Vercel account
2. The Vercel CLI installed (`npm install -g vercel`)
3. A PostgreSQL database (see [README-POSTGRES.md](README-POSTGRES.md) for setup instructions)

## Deployment Steps

1. **Set up environment variables in Vercel dashboard:**
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - A random string for JWT token signing
   - `CORS_ORIGIN` - Your frontend URL (e.g., https://your-app.vercel.app)
   - `ADMIN_USERNAME` - Default admin username (optional)
   - `ADMIN_PASSWORD_HASH` - Hashed password for admin (optional)

2. **Deploy using Vercel CLI:**
   ```bash
   vercel --prod
   ```

3. **Or deploy using Git integration:**
   - Connect your Git repository to Vercel
   - Set the root directory to `server`
   - Set the build command to `npm install` (if needed)
   - Set the output directory to ` ` (empty)

## Available Endpoints

After deployment, your API will be available at the following endpoints:

- **Root**: `GET /` - API information
- **API Docs**: `GET /api/docs` - List of available endpoints
- **Health Check**: `GET /api/health` - Health status
- **Environment Info**: `GET /api/env` - Environment variables info
- **Database Test**: `GET /api/test/db-test` - Database connection test

## Important Notes

1. **Database**: The application now uses PostgreSQL instead of SQLite for better compatibility with Vercel.

2. **File Uploads**: Uploaded files will be stored in `/tmp/uploads` directory in Vercel deployments.

3. **PDF Generation**: PDF generation is disabled in Vercel environments due to Puppeteer limitations.

## Troubleshooting

1. **Check environment variables**: Visit `/api/env` to see which environment variables are set.

2. **Test database connection**: Visit `/api/test/db-test` to test the database connection.

3. **Check logs**: Use the Vercel dashboard to check deployment and runtime logs.

## Limitations in Vercel Environment

1. **File System**: Only the `/tmp` directory is writable.
2. **Long-running processes**: Functions have a maximum execution time.
3. **PDF Generation**: Puppeteer is not available in Vercel serverless functions.

## Migration from SQLite to PostgreSQL

If you were previously using SQLite:

1. Export your data from SQLite
2. Set up a PostgreSQL database
3. Update your environment variables to use PostgreSQL
4. Deploy the updated application
5. Import your data to PostgreSQL

See [README-POSTGRES.md](README-POSTGRES.md) for detailed PostgreSQL setup instructions.

## Configuration

The vercel.json file has been updated to be compatible with Vercel's current requirements:
- Removed the conflicting `functions` property
- Removed environment variable references (should be set in Vercel dashboard)
- Kept only the necessary `builds` property