# Menuo — Frontend

Subscription SaaS for restaurants: build a digital menu, manage dishes and prices, generate QR codes, and share a public menu that customers open without logging in.

**Stack:** React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · Axios · React Hook Form · React Hot Toast · Lucide · qrcode.react

## Getting started

```bash
cd client
npm install
cp .env.example .env   # already done in this repo
npm run dev            # http://localhost:5173
npm run build          # production build in dist/
```

With `VITE_USE_MOCK=true` (default) the app runs fully in the browser — no backend needed. Data is stored in `localStorage`.

**Demo login (mock mode):** `demo@menuo.app` / `demo1234` (one-click button on the login page)
**Demo public menu:** http://localhost:5173/m/the-food-villa

To reset demo data: *Settings → Account → Reset data*.

## Connecting the real backend

The API lives in [`../server`](../server/README.md). To use it:

```env
VITE_API_URL=http://localhost:5000/api
VITE_USE_MOCK=false
```

Every request goes through `src/lib/api.js`: an Axios instance with `withCredentials: true`. The session is an **HttpOnly cookie** set by the API, so no token is stored in the browser. Each state-changing request sends an `X-CSRF-Token` header fetched from `GET /auth/csrf`. A `401` logs the user out.

The mock in `src/lib/mock/adapter.js` implements the same contract in the browser, so the app works in both modes. In mock mode payments are disabled, and checkout never pretends to succeed.

## Routes

| Path | Page | Access |
|---|---|---|
| `/` | Landing page (hero, features, pricing, FAQ) | Public |
| `/login`, `/register` | Auth | Guests only |
| `/forgot-password` | Explains that email reset isn't available yet and links to support | Guests only |
| `/dashboard` | Overview: stats, views chart, setup checklist | Owner |
| `/dashboard/menu` | Menu builder: categories & items CRUD | Owner |
| `/dashboard/qr` | QR generator: colours, frame, PNG/SVG, print | Owner |
| `/dashboard/billing` | Plan, usage, Razorpay checkout, payments, cancel | Owner |
| `/dashboard/settings` | Restaurant profile, branding, account | Owner |
| `/m/:slug` | Customer-facing digital menu | Public, no login |

An owner can have several restaurants. The sidebar switcher selects the active one (remembered in `localStorage`), and an owner with no restaurant sees a "Create your restaurant" form.

## API contract

The full reference with examples is in **[server/docs/API.md](../server/docs/API.md)**. The services in `src/services/` call:

| Area | Endpoints |
|---|---|
| Auth | `GET /auth/csrf`, `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/profile`, `PATCH /auth/password` |
| Restaurants | `GET /restaurants/mine`, `POST /restaurants`, `GET/PATCH/DELETE /restaurants/:id`, `GET /restaurants/:id/stats` |
| Menu | `GET/POST /menu/:restaurantId`, `PATCH/DELETE /menu/item/:id`, `POST /menu/item/:id/duplicate`, `GET/POST /menu/:restaurantId/categories`, `PATCH/DELETE /menu/category/:id`, `PUT /menu/:restaurantId/categories/order` |
| Public | `GET /public/menu/:slug`, `POST /public/menu/:slug/views` |
| Billing | `GET /subscriptions/plans`, `GET /subscriptions/current?restaurantId=`, `GET /subscriptions/payments?restaurantId=`, `POST /subscriptions/checkout`, `POST /subscriptions/verify`, `POST /subscriptions/cancel` |

Plans: **Starter ₹199/month (50 items)** and **Pro ₹399/month (unlimited)**, with a **7-day trial** for a new owner's first restaurant. Limits are enforced by the API. `src/lib/constants.js` only holds the marketing copy, so keep its prices in sync with `server/config/plans.js`.

`imageUrl`, `logo` and `cover` are sent as compressed data URLs (≤ ~1 MB). For production, swap `readImageFile` in `src/lib/utils.js` for an upload to your storage (S3/Cloudinary) and send the resulting `https://` URL instead.

Item `tags` values: `veg`, `non-veg`, `vegan`, `spicy`, `gluten-free`, `bestseller`.

## Project structure

```
src/
  App.jsx                 route table (pages are lazy-loaded)
  main.jsx                providers: Router, Auth, Toaster
  index.css               Tailwind v4 theme tokens (brand #086FFD, ink #191b1f)
  lib/
    api.js                Axios instance, cookie credentials, CSRF header, 401 handling
    constants.js          plans & limits, currencies, dietary tags
    utils.js              formatting, slugify, image compression, downloads
    mock/                 localStorage database + Axios mock adapter
  services/               one module per API area
  context/                AuthContext (session), WorkspaceContext (restaurant + plan)
  components/
    ui/                   Button, Field/Input/Select, Modal, Switch, Badge, Dropdown, …
    layout/               Dashboard shell, marketing navbar/footer, auth layout
    landing/              landing sections, pricing cards, phone mockup
    menu/                 item/category forms, food thumbnail, veg marks, views chart
    routing/              ProtectedRoute / GuestRoute, ScrollToTop
  pages/                  marketing, auth, dashboard, public menu, 404
```

## Notes before launch

- Landing-page stats (“2,000+ restaurants”, “1.2M scans”), testimonials and the support email are **placeholder copy** — replace them with real data.
- Plan prices and limits are enforced by `server/config/plans.js`; `src/lib/constants.js` mirrors them for display.
- The public menu URL uses the current origin (`/m/:slug`). Configure your host to serve `index.html` for all routes (SPA fallback).
