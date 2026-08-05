# StarBridge

A cozy two-player co-op puzzle game for long-distance couples.

## Files (all flat, no folders — easy to upload from a phone)
```
package.json
server.js
index.html
style.css
client.js
```

## Deploy for free, entirely from your phone

**1. Get the files onto your phone**
Download all 5 files above from this chat (tap each, save to Files/Downloads).

**2. Create a GitHub repo (mobile browser, github.com)**
- Sign in (or sign up) at github.com in your phone's browser
- Tap the **+** in the top right → **New repository**
- Name it `starbridge`, keep it Public, tap **Create repository**

**3. Upload the files**
- On the new repo's page, tap **Add file → Upload files**
- Tap the upload area, it opens your phone's file picker — go to Downloads,
  select all 5 files at once (server.js, package.json, index.html, style.css,
  client.js), confirm
- Scroll down, tap **Commit changes**

**4. Deploy on Render (mobile browser, render.com)**
- Sign up at render.com — easiest with "Sign up with GitHub"
- Tap **New +** → **Web Service**
- Authorize Render to see your repos, pick `starbridge`
- Settings:
  - **Runtime**: Node
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`
  - **Instance Type**: Free
- Tap **Create Web Service**

**5. Wait ~1-2 minutes.** Render gives you a link like
`https://starbridge-xyz.onrender.com` — that's the link you send her. She
just opens it, no installs, works on her phone or laptop.

One thing to know: Render's free tier sleeps after 15 min of no traffic, so
the very first open after a while takes ~30-50 seconds to wake up. Normal —
just don't worry if it looks blank for a moment.

## How it plays
- **Constellation tab**: a 5×5 star grid lights up a few target stars each
  round — a star only locks in once *both* of you click it, so you're
  coordinating in real time.
- **Garden tab**: pick a seed emoji, click anywhere on the shared canvas to
  plant it. You'll see your partner's glowing cursor too.
- **Dock**: text chat + one-tap floating emotes (💖🤗😘🥹😢🎉).

## Notes
- Room state lives in memory — a server restart clears open rooms, fine for
  casual two-person use.
- Empty rooms auto-clear ~10 minutes after both players disconnect.
- If a connection drops mid-session, rejoin with the same room code.
