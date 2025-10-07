# PostgreSQL Database Setup

This document provides instructions for setting up PostgreSQL database for the Hefti Academy server.

## Prerequisites

1. PostgreSQL database server (local or cloud-based like Supabase, Render, or AWS RDS)
2. Database connection URL

## Setup Instructions

1. **Create a PostgreSQL database**
   - You can use a local PostgreSQL installation, or a cloud service like:
     - Supabase (https://supabase.com)
     - Render (https://render.com)
     - AWS RDS
     - Heroku Postgres
     - DigitalOcean PostgreSQL

2. **Set environment variables:**
   ```
   DATABASE_URL=your_postgresql_connection_string
   ```

3. **The application will automatically:**
   - Connect to the PostgreSQL database
   - Create tables if they don't exist
   - Set up necessary indexes
   - Create an admin user if none exists

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string

Optional:
- `ADMIN_USERNAME` - Default admin username (defaults to 'admin')
- `ADMIN_PASSWORD_HASH` - Hashed password for admin (defaults to bcrypt hash of 'admin123')
- `ADMIN_EMAIL` - Admin email address

## PostgreSQL Connection String Format

```
postgresql://username:password@host:port/database_name
```

Examples:
- Local: `postgresql://user:password@localhost:5432/hefti_academy`
- Supabase: `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-SUPABASE-PROJECT-ID].supabase.co:5432/postgres`

## Benefits of Using PostgreSQL

1. **Better for production**: PostgreSQL is more robust than SQLite for production deployments
2. **Scalability**: Better performance with larger datasets
3. **Vercel compatibility**: Works well with Vercel's serverless environment
4. **Data persistence**: No issues with file system limitations in cloud environments
5. **Concurrent access**: Better handling of multiple simultaneous connections

## Migration from SQLite

If you're migrating from SQLite:

1. Export your data from SQLite
2. Set up PostgreSQL database
3. Update environment variables to use PostgreSQL
4. Deploy the application
5. Import your data to PostgreSQL

## Troubleshooting

1. **Connection issues**: Verify your DATABASE_URL is correct and the database is accessible
2. **Permission issues**: Ensure your database user has proper permissions
3. **SSL issues**: Some cloud providers require SSL connections

You can test your database connection by visiting `/api/test/db-test` after deployment.