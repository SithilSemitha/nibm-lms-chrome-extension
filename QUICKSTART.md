# 🚀 Quick Start Guide

## Get Started in 5 Minutes

### Step 1: Setup Database (2 minutes)

```bash
# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE lms_activities;
CREATE USER lms_user WITH PASSWORD 'mypassword123';
GRANT ALL PRIVILEGES ON DATABASE lms_activities TO lms_user;
\q
```

```bash
# Load schema
psql -U lms_user -d lms_activities -f database/schema.sql
```

### Step 2: Setup Backend (1 minute)

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env (update password!)
nano .env
```

Update these lines in `.env`:
```
DB_PASSWORD=mypassword123
JWT_SECRET=use_a_random_32_character_string_here
```

```bash
# Start server
npm start
```

### Step 3: Setup Extension (2 minutes)

```bash
cd ../extension/icons

# Generate icons (quick method)
convert -size 16x16 xc:#667eea icon16.png
convert -size 32x32 xc:#667eea icon32.png
convert -size 48x48 xc:#667eea icon48.png
convert -size 128x128 xc:#667eea icon128.png
```

**Load in Chrome:**
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

### Step 4: Test It! (30 seconds)

1. Click the extension icon in Chrome
2. Register a new account
3. Add your first activity
4. Visit https://lms.nibmworldwide.com/ to see the floating button

## 🎉 Done!

You now have a fully functional LMS Activity Manager!

## Next Steps

- Read `INSTALLATION.md` for detailed setup
- Check `API_DOCUMENTATION.md` for API reference
- See `DEVELOPMENT.md` for customization guide

## Need Help?

Common issues:
- **Database connection error**: Check PostgreSQL is running
- **Extension not loading**: Make sure icon files exist
- **Cannot login**: Check backend server is running on port 3000

## Features to Try

✅ Add activities with different types  
✅ Set priorities and deadlines  
✅ Mark activities as complete  
✅ View analytics and statistics  
✅ Get notifications for upcoming deadlines  
✅ Quick-add from LMS pages  

Happy organizing! 📚✨
