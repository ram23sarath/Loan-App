# Quick Deployment Guide: Automatic User Creation

## 60-Second Setup

### Step 1: Deploy to Netlify
```bash
git add .
git commit -m "Add automatic user creation on customer signup"
git push origin main
```

### Step 2: Add Environment Variables
1. Go to **Netlify Dashboard**
2. Click your site
3. **Settings → Environment**
4. Add two variables:
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** Your service role key (from Supabase Settings → API)
   - **Key:** `SUPABASE_URL`
   - **Value:** Your Supabase URL

### Step 3: Trigger Deployment
- Push a new commit, OR
- Click **Deploy site** in Netlify dashboard

### Step 4: Test
```
1. Open app
2. Add Customer: "Test User" / "1234567890"
3. Press F12 (DevTools)
4. Look for: "✅ User auto-created: [id]"
5. Try login: 1234567890@gmail.com / 1234567890
```

## Where to Get Keys

### SUPABASE_SERVICE_ROLE_KEY
1. Open Supabase Dashboard
2. Go to **Settings → API**
3. Copy **Service Role Secret** (not Anon Key!)

### SUPABASE_URL
1. Same place (Settings → API)
2. Copy **Project URL**

## What Happens Now

✅ **Every new customer** automatically gets a Supabase user
- Email: `{phone}@gmail.com`
- Password: `{phone}`
- User can log in immediately
- User can change password in app

## For Existing Customers

Use the batch script to create users for customers added before deployment:

```bash
export SUPABASE_SERVICE_ROLE_KEY="your-key-here"
node scripts/create-users-from-customers.js
```

## Troubleshooting

| Problem | Check |
|---------|-------|
| "Server configuration error" | SUPABASE_SERVICE_ROLE_KEY env var set? |
| No "User auto-created" message | Check Netlify function logs |
| Email already exists error | Delete duplicate in Supabase Auth |

## Full Documentation

📖 See `AUTO_USER_CREATION.md` for complete guide including:
- API reference
- Security details
- Advanced troubleshooting
- Performance info

---

**That's it!** Your app now automatically creates users for new customers.
