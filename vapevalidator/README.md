# VapeValidator 🌬️

Rate your vape tricks with AI. Three modes: Ghost, O-Rings, French Inhale.

---

## Deploy to Vercel (5 minutes)

### Step 1 — Get a free Vercel account
Go to https://vercel.com and sign up for free with GitHub.

### Step 2 — Get a free GitHub account & upload this folder
1. Go to https://github.com and create a free account
2. Click **"New repository"** → name it `vapevalidator` → click **Create**
3. Upload all files from this folder by dragging them into the GitHub web UI
   (or use GitHub Desktop app if you prefer)

### Step 3 — Deploy on Vercel
1. Go to https://vercel.com/new
2. Click **"Import Git Repository"**
3. Select your `vapevalidator` repo
4. Click **Deploy** — Vercel auto-detects Vite ✅

### Step 4 — Add your Anthropic API key (REQUIRED)
1. In Vercel, go to your project → **Settings** → **Environment Variables**
2. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your API key from https://console.anthropic.com/keys
3. Click **Save**
4. Go to **Deployments** → click the three dots on your latest deploy → **Redeploy**

### Step 5 — Add to Home Screen
Once deployed, Vercel gives you a URL like `vapevalidator.vercel.app`

**iPhone:**
1. Open the URL in Safari
2. Tap Share → "Add to Home Screen" → Add
3. Done! It opens like a native app 📱

**Android:**
1. Open the URL in Chrome
2. Tap ⋮ menu → "Add to Home Screen"
3. Done! 📱

---

## Get your Anthropic API key
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Click **API Keys** → **Create Key**
4. Copy it and paste it into Vercel (Step 4 above)

Note: API calls cost a small amount per analysis (~$0.01–0.03 per trick scored).
New accounts get free credits to start.

---

## Project Structure
```
vapevalidator/
├── index.html          # Entry point
├── vite.config.js      # Build config
├── vercel.json         # Deployment config
├── package.json
├── public/
│   ├── manifest.json   # PWA manifest (home screen icon config)
│   ├── sw.js           # Service worker (offline support)
│   ├── icon-192.png    # App icon
│   └── icon-512.png    # App icon (large)
├── src/
│   ├── main.jsx        # React entry + service worker registration
│   └── App.jsx         # Full app code
└── api/
    └── analyze.js      # Serverless proxy (keeps API key secret)
```
