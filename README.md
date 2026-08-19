# StarBridge

> A private shared sky for two people who are apart.

StarBridge is a cozy, persistent two-person connection app. Create a private room, share its short invite code, then meet in a shared constellation puzzle, garden, and dock for messages and emotes.

It is built with **Next.js App Router**, **Supabase Postgres**, **Supabase Realtime**, and signed browser sessions. The app is designed to work well on phones as well as desktop browsers.

## What is included

### Private rooms and returning sessions

- Create a private room with a name, no email or password required.
- 8-character invite codes using unambiguous uppercase letters and digits.
- Join a partner's room with their code.
- Exactly two seats per room.
- 90-day signed browser session cookie for the active room.
- Same-name re-entry reclaims the existing room seat instead of creating a duplicate user row.
- Sign out clears the active browser session, not the shared room data.
- Device-local **My Rooms** history with a cookie mirror, copyable room codes, and forget controls.
- Invite modal in the room header for sharing a room code/link.

### Shared Constellation

- Server-created, persistent constellation rounds.
- Easy, Normal, Hard, and Custom difficulty foundations.
- Configurable grid and target count through room settings.
- Both people must choose the same target star to lock it in.
- Pending stars visibly show when one person has selected them.
- Locked stars receive a warm gold glow.
- Live room-state refresh fallback keeps both devices synchronized when Realtime delivery is delayed.

### Shared Garden

- Pick a seed emoji and plant it anywhere in the shared garden.
- Plants are saved persistently in Supabase.
- Garden updates are delivered through Realtime subscriptions.

### Dock

- Persistent room chat with timestamps.
- Floating shared emotes.
- Designed empty states for a new room.

### Settings and audit history

- Shared constellation difficulty selection.
- Sound, reduce-motion, and theme preferences.
- Day/night appearance options.
- Account sign out.
- Mutually visible audit events for account, settings, and game milestones.

### Visual system

- Deep indigo starry-night background with animated twinkles and occasional shooting stars.
- Warm rose-gold and lavender glows.
- Rounded glass cards, pill controls, soft elevation, and mobile-safe touch targets.
- Responsive layouts for phone, tablet, and desktop.

## Tech stack

- [Next.js](https://nextjs.org/) 16, App Router, TypeScript
- [Supabase](https://supabase.com/), Postgres and Realtime
- `@supabase/supabase-js`
- Signed room sessions using `jose`
- Tailwind/PostCSS baseline with custom CSS design tokens
- Lucide icons

## Repository structure

```text
src/
  app/
    api/
      game/          # constellation round and star actions
      my-rooms/      # browser room-history cookie mirror
      room/          # create, join, reclaim, and sign-out flow
      room-state/    # authenticated room sync snapshot
      session/       # session status
    room/            # protected shared room route
    rooms/           # standalone My Rooms view
    globals.css      # shared visual system
    page.tsx         # landing/create/join/My Rooms modal
  components/
    RoomApp.tsx      # Constellation, Garden, Dock, settings, invite UI
  lib/
    session.ts       # signed 90-day room JWT helpers
    supabase-*.ts    # server and browser Supabase clients
supabase/
  migrations/
    001_initial.sql  # persistent schema and Realtime publication setup
```

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project

## Environment variables

Create `.env.local` in the repository root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET=use-a-long-random-secret-here
```

Generate a strong session secret with:

```bash
openssl rand -base64 48
```

Never commit `.env.local`, `.env.production`, Supabase keys, or `SESSION_SECRET`.

## Database setup

1. Create a Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Create a new query.
4. Copy and run the full contents of:

   ```text
   supabase/migrations/001_initial.sql
   ```

The migration creates the persistent tables for:

- Rooms and users
- Signed-session records
- Constellation rounds and stars
- Garden plants
- Messages and emotes
- User settings
- Join rate limits
- Audit log

It also enables Realtime publication for the tables used by the live app.

## Local development

Install dependencies:

```bash
npm install
```

Run development mode:

```bash
npm run dev
```

Open http://localhost:3000.

For a production-equivalent check:

```bash
npm run build
npm run start
```

## Room flow

### Create a room

1. Enter a display name.
2. Select **Create our room**.
3. Open **Invite** in the room header.
4. Share the 8-character code or copied invite link with your partner.

### Join a room

1. Enter a display name.
2. Enter the 6–8 character room code.
3. Select **Join the sky**.

A room has two seats. If a returning person enters the same room code and same display name after signing out, StarBridge reclaims their existing seat rather than inserting a duplicate user.

### Refreshes, sign-out, and My Rooms

- Refreshing should restore the active signed browser session.
- **Sign out** clears the active room cookie but preserves shared room content.
- **My Rooms on this device** is a browser-local history helper. It stores room codes locally and mirrors a small recent list in a cookie.
- Forgetting a room in My Rooms only removes it from that browser's history. It does not delete room data or sign out an active room.

## Deployment

StarBridge is a standard Next.js app and can be deployed to Vercel, Render, Railway, Fly.io, or another Node-compatible platform.

Configure the same four environment variables in your host's secrets/settings panel:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET
```

Build command:

```bash
npm run build
```

Start command:

```bash
npm run start
```

### Notes for self-hosting

- Use HTTPS in production.
- Keep `SESSION_SECRET` stable across restarts, otherwise existing signed sessions become invalid.
- Supabase is the persistent source of truth. Application processes can restart without losing rooms, messages, gardens, or constellation history.
- The service-role key is server-only. Never expose it to browser code.

## Security and privacy model

StarBridge is deliberately small and private, but invite codes are not a full account recovery system.

- Invite codes are short secrets intended to be shared directly with one partner.
- Usernames are unique only within a room, not globally.
- My Rooms is scoped to the current browser/device.
- There is no public room directory or username lookup.
- Audit history logs security/settings events, not message contents, individual plants, or individual star clicks.
- Join attempts are rate-limited per IP and code.

## Resetting development data

To clear all application data while keeping the schema and migration intact, run this in Supabase SQL Editor:

```sql
truncate table
  audit_log,
  join_rate_limits,
  constellation_stars,
  constellation_rounds,
  garden_plants,
  messages,
  emotes,
  user_settings,
  sessions,
  users,
  rooms
restart identity cascade;
```

After a reset, clear browser site data/cookies for the app domain before creating a new room. This prevents a stale browser session from pointing to a deleted user.

## Quality checks

Before pushing changes, run:

```bash
npm run build
```

The production build checks TypeScript, App Router routes, and bundle generation.

## License

Private project. Add a license here if you plan to publish or share StarBridge publicly.
