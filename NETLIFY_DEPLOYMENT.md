# Deploying Roadguard on Netlify

Roadguard is fully optimized for one-click deployment on [Netlify](https://www.netlify.com/).

## 🚀 Quick Setup (Git Repository)

1. **Push this repository** to GitHub, GitLab, or Bitbucket.
2. Go to **Netlify** -> **Add new site** -> **Import an existing project**.
3. Select your repository.
4. Netlify will automatically detect `netlify.toml` with the following pre-configured settings:
   - **Build command**: `npm run build` (or `npm run build:netlify`)
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
5. Click **Deploy Site**.

---

## 🔑 Environment Variables

In your Netlify site dashboard under **Site configuration** -> **Environment variables**, you can optionally add:

| Key | Description | Optional? |
|---|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API Key for real-time AI road vision inspection (`gemini-3.8-flash`) | Yes (app runs with intelligent fallback civil inspection when omitted) |
| `NODE_VERSION` | Set to `20` (already pre-configured in `netlify.toml`) | Optional |

---

## 📂 Architecture on Netlify

- **Static Frontend SPA**: Vite + React 19 + Tailwind CSS hosted on Netlify's high-speed global Edge CDN.
- **Client-Side Routing**: SPA fallback configured via `netlify.toml` and `public/_redirects` (`/* -> /index.html 200`).
- **Serverless Vision API**:
  - `POST /api/scan` & `POST /scan` -> powered by `netlify/functions/scan.ts`
  - `GET /health` & `GET /healthz` -> powered by `netlify/functions/health.ts`
- **Offline / On-Device Persistence**: Runs in browser storage (`localStorage` & `IndexedDB`) so all reports and driver radar records function smoothly without database configuration.
