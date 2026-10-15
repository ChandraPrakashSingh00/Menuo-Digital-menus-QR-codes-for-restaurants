# Menuo

Subscription SaaS for restaurants: digital menus, QR codes and a public menu customers open without logging in.

## Project structure

```
.
├── client/     React + Vite + Tailwind frontend   (see client/README.md)
└── server/     Express + MongoDB API              (see server/README.md, server/docs/API.md)
```

## Run the frontend only (in-browser demo, no backend)

```bash
cd client
npm install
npm run dev     # http://localhost:5173
```

`client/.env` has `VITE_USE_MOCK=true` by default. Demo login: `demo@menuo.app` / `demo1234`. Payments are disabled in this mode.

## Run frontend + backend together

```bash
# terminal 1 — API on http://localhost:5000
cd server
npm install
cp .env.example .env      # set MONGODB_URI and JWT_SECRET
npm run seed:demo         # optional demo data (/m/the-food-villa)
npm run dev

# terminal 2 — app on http://localhost:5173
cd client
# in client/.env:  VITE_USE_MOCK=false  and  VITE_API_URL=http://localhost:5000/api
npm run dev
```

Open `http://localhost:5173` (use `localhost`, not `127.0.0.1`, so the session cookie is sent).
For MongoDB Atlas, Razorpay test mode, deployment and the feature checklist, see [server/README.md](server/README.md).

## Deploy on Vercel (frontend + API in one project)

`vercel.json` builds `client/` as a static site and runs the Express API from `server/` as one serverless function (`api/index.js` → `server/serverless.js`). Every `/api/*` request goes to the function and every other path falls back to `index.html`. The app and the API share one domain, so the session cookie stays first-party (`SameSite=Lax`) and no CORS setup is needed.

1. **MongoDB Atlas:** create a free M0 cluster in **AWS Mumbai (ap-south-1)**, next to the `bom1` function region in `vercel.json`. Add a database user. Under *Network Access*, allow `0.0.0.0/0`, because Vercel functions have no fixed IP. Copy the connection string and add the database name: `…mongodb.net/menuo?retryWrites=true&w=majority`.
2. **Vercel:** *Add New → Project*, then import this GitHub repo. Keep the Root Directory as `./`. `vercel.json` sets the install command, build command and output directory.
3. **Environment variables** (Production and Preview):

   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | the Atlas connection string |
   | `JWT_SECRET` | 48+ random chars: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

   Do **not** set `NODE_ENV`. On Vercel the API already defaults to `production` and `TRUST_PROXY=1`, and it trusts the deployment's own URLs for CSRF. If `NODE_ENV=production` is set at build time, `npm ci` skips Vite. `CLIENT_ORIGINS` is only needed for extra custom domains beyond the primary one. Razorpay variables can be added later. Webhook URL: `https://<your-domain>/api/webhooks/razorpay`.
4. **Deploy.** Check `https://<your-domain>/api/health`. It should return `{"status":"ok","database":"connected"}`. After that, every push to `main` deploys automatically.

For a frontend-only demo without a database, set `VITE_USE_MOCK=true` in Vercel and redeploy.
