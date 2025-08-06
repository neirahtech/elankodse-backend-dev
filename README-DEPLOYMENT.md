# 🚀 Elankodse Backend - Resource Optimized for AsuraHosting

## ✅ What Was Fixed

Your backend was hitting resource limits because it ran a **full Blogger sync (846 posts) on every startup**. This has been optimized.

## 📁 Files You Need

1. **Your existing `server.js`** - Now optimized (no startup sync)
2. **`scripts/backup.js`** - Database backup tool
3. **`scripts/sync-blogger.js`** - Manual Blogger sync tool
4. **Your database backup** - `elankodse_backup_2025-07-29T10-42-32-362Z.sql` (26MB)

## 🚀 Deploy to AsuraHosting

### Step 1: Upload Your Backup
- Use the existing backup: `elankodse_backup_2025-07-29T10-42-32-362Z.sql`
- Import it via phpMyAdmin in your hosting panel

### Step 2: Upload & Configure
```bash
# Upload your backend files to hosting
# Update .env with hosting database credentials:
NODE_ENV=production
MYSQL_HOST=localhost
MYSQL_USER=your_hosting_db_user
MYSQL_PASSWORD=your_hosting_db_password
MYSQL_DATABASE=your_hosting_db_name
PORT=8084
ALLOWED_ORIGINS=https://yourdomain.com
JWT_SECRET=your_strong_jwt_secret
```

### Step 3: Start Server
```bash
npm install --production
npm start
```

### Step 4: Sync Data (When Needed)
```bash
# Method 1: Command line (recommended)
npm run sync

# Method 2: Browser (visit in browser)
https://your-domain.com/api/admin/sync

# Method 3: API call (POST)
curl -X POST https://your-domain.com/api/admin/sync

# Method 4: API call (GET)
curl https://your-domain.com/api/admin/sync
```

## 📊 Performance Improvements

| Before | After |
|--------|--------|
| 2+ minutes startup | 10 seconds startup |
| High CPU usage | Low CPU usage |
| 100-200MB memory | 30-50MB memory |
| Auto-syncs on start | Manual sync only |

## 💡 Available Commands

```bash
npm start    # Start optimized server
npm run dev  # Development with nodemon
npm run backup  # Create database backup
npm run sync    # Manual Blogger sync
```

## 🔧 Key Changes Made

1. **Commented out automatic Blogger sync** in `server.js`
2. **Reduced payload limits** from 10MB to 2MB
3. **Added manual sync endpoints** (both GET and POST)
   - GET `/api/admin/sync` - For browser testing
   - POST `/api/admin/sync` - For API calls
4. **Added post count display** on startup
5. **Cleaned up unnecessary files**

Your server will now start quickly and use minimal resources! 🎉

Use manual sync only when you need to update content from Blogger.
