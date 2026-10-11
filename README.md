# ASCEND · Piyumal OS

A 3D, animated personal timetable and life plan: 04:00 → 22:00, built around four goals (career, Fiverr, four content channels, wealth research) and the daily habits of successful people.

Built with Vite, React 18, three.js (react-three-fiber + drei) and framer-motion. No backend: ticks, channel names and plan choice are saved in the browser's localStorage.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Deploy free on Vercel

**Option A: GitHub (recommended, auto-deploys on every push)**

1. Push this `life-os` folder to a new GitHub repo.
2. Go to vercel.com → Add New → Project → import the repo.
3. Vercel detects Vite. Keep the defaults (build `npm run build`, output `dist`) → Deploy.

**Option B: CLI**

```bash
npm i -g vercel
vercel          # first time: log in and accept the defaults
vercel --prod
```

## Edit your plan

| What | File |
| --- | --- |
| Timetable blocks (Plan A / Plan B, weekdays, Sat, Sun) | `src/data/schedule.js` |
| Fiverr gigs, 30-day launch, levels | `src/data/fiverr.js` |
| Certs, English, content pipeline, wealth curriculum, roadmap, scorecard | `src/data/growth.js` |
| Successful men research | `src/data/legends.js` |
| Pillar colours | `src/data/pillars.js` |

Times are approximate where noted (commute, office hours). Adjust them in `schedule.js` and the dial, timeline, live "NOW" card and weekly hours all update automatically.
