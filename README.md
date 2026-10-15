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
