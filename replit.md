# محمّل الفيديو العالمي — Universal Video Downloader

موقع ويب لتحميل الفيديوهات من أكثر من 1800 منصة حول العالم باستخدام yt-dlp.

## Run & Operate

- `python3 /home/runner/workspace/artifacts/api-server/app.py` — run the Flask API server (port 8080)
- `pnpm --filter @workspace/video-downloader run dev` — run the React frontend (port assigned by Replit)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + Framer Motion
- API: Python 3 + Flask + Flask-CORS
- Video extraction: yt-dlp (supports 1800+ sites)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/video-downloader/src/App.tsx` — main frontend UI (single-page app, RTL Arabic)
- `artifacts/video-downloader/src/index.css` — dark navy theme with Tailwind CSS variables
- `artifacts/api-server/app.py` — Flask backend with yt-dlp integration
- `artifacts/api-server/requirements.txt` — Python dependencies
- `artifacts/api-server/start.sh` — startup script (install deps + run server)

## Architecture decisions

- Python/Flask replaces the Node.js Express server to use yt-dlp natively without subprocess overhead.
- yt-dlp is called with `skip_download=True` so the server only extracts metadata and direct URLs — no files are stored on the server.
- Error messages are returned in Arabic to match the UI language.
- Optional `cookies.txt` (Netscape format) support for platforms requiring login.
- Optional `PROXY` environment variable for proxy routing.

## Product

- Paste any video URL → get direct download links (video + audio)
- Supports YouTube, TikTok, Facebook, Instagram, Twitter/X, Vimeo, Dailymotion, Twitch, Reddit, Snapchat, and 1800+ others
- RTL Arabic interface, responsive for mobile

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- NixOS immutable filesystem: `pip install --upgrade yt-dlp` fails silently (expected). Use `--break-system-packages` in production builds.
- yt-dlp workflow run command uses absolute path: `python3 /home/runner/workspace/artifacts/api-server/app.py` — relative paths fail because workflow CWD is not the workspace root.
- DRM-protected content (Netflix, etc.) will never work — this is a yt-dlp limitation.
- Some platform URLs (Instagram private, Twitter login-gated) require a `cookies.txt` file in Netscape format.

## API

`POST /api/download` — `{ "url": "..." }` → `{ success, title, thumbnail, duration_human, uploader, platform, formats: [{type, quality, ext, url, label}] }`

`GET /api/healthz` → `{ "status": "ok" }`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
