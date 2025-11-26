# Quick Start: Environment Setup & Password Reset

## 🚀 Fastest Way to Get Started (2 minutes)

### Step 1: Run Setup Script
```bash
npm run setup-env
```

This will:
1. ✅ Ask for your Supabase URL
2. ✅ Ask for your Service Role Key
3. ✅ Create `.env` file
4. ✅ Update `.gitignore`

### Step 2: Reset a Password
```bash
npm run reset-password
```

Done! 🎉

---

## 📋 Manual Setup (If You Prefer)

### Step 1: Get Your Credentials
1. Go to https://app.supabase.com
2. Select your project
3. Settings → API
4. Copy these values:
   - **Project URL** (labeled as "Project URL")
   - **Service Role key** (under "Project API keys")

### Step 2: Create `.env` File
Create a file named `.env` in your project root:

**File**: `Loan-App/.env`
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 3: Verify `.gitignore` Has `.env`
Open `.gitignore` and make sure it contains:
```
.env
```

### Step 4: Reset Password
```bash
npm run reset-password
```

---

## 💻 Usage Examples

### Interactive Mode (Recommended - Passwords Hidden)
```bash
npm run reset-password

# Prompts:
# Enter customer email address: customer@example.com
# Enter new password: (input hidden)
# Confirm new password: (input hidden)
```

### With Email Argument
```bash
npm run reset-password customer@example.com

# Prompts for password only
# Enter new password: (input hidden)
# Confirm new password: (input hidden)
```

### Direct Command (Use with Caution - Visible in History)
```bash
npm run reset-password customer@example.com NewPassword123
```

---

## 🔍 Verify Environment Is Set Up

Check if your .env file is loaded:

```bash
# This should show your Supabase URL if everything is set up
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"
```

---

## 🔐 Security Checklist

- ✅ `.env` file is in `.gitignore`
- ✅ `.env` file is NOT committed to git
- ✅ Service Role Key is kept secret
- ✅ `.env` file only exists on your local machine
- ✅ Different environments use different keys

---

## ❓ Troubleshooting

### Error: "SUPABASE_URL environment variable is not set"

**Solution**: Make sure `.env` file exists in project root with both variables.

**File location should be:**
```
Loan-App/
  ├── .env ← HERE
  ├── package.json
  ├── scripts/
  └── ...
```

### Error: "dotenv not found"

**Solution**: Install it:
```bash
npm install dotenv
```

### Password reset works but credentials not loading

**Solution**: Make sure `.env` file is in the correct location:
```bash
# From project root directory
pwd  # Check current directory
ls -la .env  # Should exist

# Windows PowerShell
Get-ChildItem .env
```

---

## 📁 File Structure After Setup

```
Loan-App/
├── .env                          ← Your credentials (KEEP SECRET!)
├── .gitignore                    ← Contains .env (prevents git commits)
├── package.json                  ← Updated with dotenv & scripts
├── netlify/
│   └── functions/
│       └── reset-customer-password.js
├── scripts/
│   ├── setup-env.js             ← Setup wizard
│   ├── reset-password-cli.js    ← Main CLI tool
│   ├── RESET_PASSWORD_GUIDE.md  ← Full documentation
│   └── ...
└── ...
```

---

## 🎯 Available Commands

```bash
# Setup environment variables (one time)
npm run setup-env

# Reset a customer's password
npm run reset-password

# Also works directly:
node scripts/reset-password-cli.js
node scripts/setup-env.js
```

---

## 🔗 Where to Find Your Credentials

**Supabase Dashboard:**
1. https://app.supabase.com
2. Select your project
3. **Settings** (left sidebar)
4. **API** tab
5. Look for:
   - **Project URL** → Copy this for `SUPABASE_URL`
   - **Project API keys** → Under "Service Role key" → Copy for `SUPABASE_SERVICE_ROLE_KEY`

**ℹ️ Note**: Use the "Service Role key", NOT the "Anon key"

---

## 🛡️ Important Security Notes

### What's in .env?
```env
SUPABASE_URL=https://your-project.supabase.co          # Safe to share
SUPABASE_SERVICE_ROLE_KEY=super-secret-key-here       # KEEP SECRET!
```

### Keep Safe:
- ✅ `.env` file (never commit to git)
- ✅ Service Role Key (like a master password)

### Safe to Share:
- ✅ Project URL
- ✅ Anon Key (different from Service Role Key)

---

## ✨ Next Steps

1. ✅ Run `npm run setup-env`
2. ✅ Run `npm run reset-password`
3. ✅ Test it with a customer email
4. ✅ Check that password was reset
5. ✅ Login with the new password to verify

---

## 📞 Need Help?

- **Full Setup Guide**: `FILES/ENV_SETUP.md`
- **Password Reset Guide**: `scripts/RESET_PASSWORD_GUIDE.md`
- **Supabase Documentation**: https://supabase.com/docs

---

## Summary

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `npm run setup-env` | Create .env file with credentials |
| 2 | `npm run reset-password` | Reset a customer's password |
| 3 | Verify | Login with new password |

That's it! 🚀
