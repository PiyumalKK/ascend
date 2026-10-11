# ASCEND · Personal Operating System

A 3D, animated life OS for a DevOps engineer: a 04:00 → 22:00 timetable with live "what now" guidance,
progress tracking across career, Fiverr, four content channels and wealth research, synced between web and Android.

**Web:** https://ascend-outh.vercel.app · **Android:** [latest APK](https://github.com/PiyumalKK/ascend/releases/latest/download/ASCEND.apk)

## Architecture

```
React 18 + Vite + three.js (r3f) ──► Vercel (web, PWA, service worker)
        │                       └──► Capacitor 7 ──► GitHub Actions ──► signed APK release
        ▼
Supabase: Auth (owner only) · Postgres with Row Level Security · Realtime sync
```

| Area | Implementation |
| --- | --- |
| Access model | UI is public and read-only; all state requires the owner's sign-in. Sign-ups disabled. |
| Data security | RLS on every table (`user_id = auth.uid()`) plus an `is_owner()` write guard — [`supabase/migrations`](supabase/migrations) |
| Sync | Local cache for instant render → Supabase fetch → debounced upsert → Realtime updates across devices |
| Web app | Installable PWA, offline shell, Web Push handler (`src/sw.js`) |
| Android | Exact on-device weekly alarms for every timetable block (`src/lib/native.js`) |
| CI/CD | Push to `main` → Vercel deploy + Android build, PKCS12 signing from GitHub Secrets, `apksigner` verification, GitHub Release |

## Local development

```bash
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm install
npm run dev                  # http://localhost:5173
```

Android: `npm run build && npx cap sync android`, then open `android/` in Android Studio, or let CI build it.

## Configuration

| Where | Name | Purpose |
| --- | --- | --- |
| Vercel env + GitHub variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OWNER_EMAIL` | Public client config (protected by RLS) |
| GitHub secrets | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` | Release signing |

## Editing the plan

| What | File |
| --- | --- |
| Timetable (Plan A / Plan B, weekdays, Sat, Sun) | `src/data/schedule.js` |
| Fiverr gigs and launch plan | `src/data/fiverr.js` |
| Certifications, English, content, wealth, roadmap, scorecard | `src/data/growth.js` |
| Research on successful routines | `src/data/legends.js` |
