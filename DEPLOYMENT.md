# SERINCOSOL PANEL - Deployment Guide

## 🚀 Quick Deploy to Vercel

### Prerequisites
- GitHub account
- Vercel account (free tier works)
- Supabase project already set up

### Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Ready for Vercel deployment"

# Add your GitHub remote (create repo first on GitHub)
git remote add origin https://github.com/your-username/serincosol-panel.git

# Push
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. **Import** your GitHub repository
4. Vercel will auto-detect **Next.js**
5. Configure **Environment Variables**:

#### Required Environment Variables

Add these in the Vercel project settings:

| Variable | Where to find it |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon/public key |

6. Click **Deploy**

### Step 3: Run Migrations on Supabase

If you haven't already, run the migrations in Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Run each migration file in `/supabase/migrations/` in order:
   - `20240113_create_storage_bucket.sql`
   - `20240113_allow_all_read_profiles.sql`
   - `20240113_link_incidencias_profiles.sql`
   - `20240113_add_adjuntos_to_incidencias.sql`
   - `20240113_fix_rls_recursion.sql`
   - `20240114_time_tracking.sql` ✨ **(New!)**

### Step 4: Test Your Deployment

Your app will be live at: `https://your-project-name.vercel.app`

Test:
- ✅ Login
- ✅ Navigation
- ✅ Fichaje module (clock in/out)
- ✅ Admin sections

---

## 🔧 Build Configuration

Vercel automatically detects:
- **Framework**: Next.js 16
- **Build Command**: `next build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

No custom configuration needed!

---

## 🌍 Custom Domain (Optional)

1. Go to Vercel project → **Settings** → **Domains**
2. Add your custom domain (e.g., `panel.serincosol.com`)
3. Update DNS records as instructed by Vercel

---

## 🔄 Automatic Deployments

Every push to `main` branch will:
1. Trigger automatic deployment
2. Run `npm install`
3. Run `next build`
4. Deploy to production

Preview deployments created for:
- Pull requests
- Other branches

---

## 📊 Environment Variables Notes

- **Never commit** `.env.local` to git (already in `.gitignore`)
- Use `.env.example` as template
- Update variables in Vercel Dashboard when needed
- Changes to env vars require **redeployment**

---

## 🐛 Troubleshooting

### Build fails with "Module not found"
- Check `package.json` dependencies
- Clear Vercel cache: Settings → General → Clear Cache

### Supabase connection errors
- Verify environment variables are set correctly
- Check Supabase project is not paused
- Verify API keys are correct

### Time tracking not working
- Ensure `20240114_time_tracking.sql` migration was run
- Check RLS policies are enabled
- Verify functions exist: `clock_in()`, `clock_out()`

---

## 📝 Post-Deployment Checklist

- [ ] Verify all environment variables are set
- [ ] Run all Supabase migrations
- [ ] Test login functionality
- [ ] Test admin access controls
- [ ] Test fichaje (clock in/out)
- [ ] Verify RLS policies work correctly
- [ ] Test on mobile devices
- [ ] Set up custom domain (optional)
- [ ] Configure auth redirects in Supabase (add Vercel URL to allowed URLs)

---

## 🔐 Supabase Auth Configuration

After deployment, update Supabase Auth settings:

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `https://your-project.vercel.app/auth/callback`
   - `https://your-custom-domain.com/auth/callback` (if using custom domain)
3. Add to **Site URL**:
   - `https://your-project.vercel.app`

---

## 🎉 You're Live!

Your SERINCOSOL Panel is now deployed and accessible worldwide via Vercel's CDN.
