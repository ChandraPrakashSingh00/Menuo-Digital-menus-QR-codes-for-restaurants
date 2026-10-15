# Menuo — Backend API

Express + MongoDB API for Menuo, the subscription digital-menu SaaS. It handles accounts, restaurants, menus, the public QR menu, Starter/Pro subscriptions with Razorpay, and a read-only super-admin API.

**Stack:** Node.js ≥ 20.19 · Express 5 · MongoDB + Mongoose 9 · Zod 4 · JWT in HttpOnly cookies · bcryptjs · Helmet · CORS · express-rate-limit · Razorpay Subscriptions (REST)

- Full endpoint reference with examples: **[docs/API.md](docs/API.md)**
- Frontend: [`../client`](../client/README.md)

---

## 1. Quick start (local)

```bash
cd server
npm install
cp .env.example .env        # then edit .env (see below)
npm run seed:demo           # optional: demo owner + /m/the-food-villa menu
npm run dev                 # http://localhost:5000/api  (auto-restarts on changes)
```

At minimum, `.env` needs:

| Variable | Example | Notes |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://…/menuo` | Atlas (section 3) or a local `mongodb://127.0.0.1:27017/menuo` |
| `JWT_SECRET` | 48+ random chars | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_ORIGINS` | `http://localhost:5173` | Comma-separated frontend origins allowed to send cookies |

Every other variable has a safe default and is documented in [.env.example](.env.example). The server checks its configuration at startup and exits with a list of the problems. Secret values are never printed.

Check it is running: `curl http://localhost:5000/api/health` → `{"status":"ok","database":"connected"}`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with `node --watch` |
| `npm start` | Start for production |
| `npm test` | Run the automated tests (in-memory MongoDB, no network) |
| `npm run seed:demo` | Dev only: creates `demo@menuo.app` / `demo1234` with "The Food Villa" (`/m/the-food-villa`, 7-day Pro trial). Refuses to run in production. |
| `npm run create-admin -- --email you@company.com` | Promote an existing account to super admin |
| `ADMIN_PASSWORD='…' npm run create-admin -- --email you@company.com --name "You"` | Create a new admin account (password 12–72 chars, read from the environment, never from arguments) |

---

## 2. Run the frontend and backend together

1. **Backend**, in terminal 1:
   ```bash
   cd server
   npm run dev
   ```
2. **Frontend**: edit `client/.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_USE_MOCK=false
   ```
   Then in terminal 2:
   ```bash
   cd client
   npm install
   npm run dev                 # http://localhost:5173
   ```
3. Open **http://localhost:5173** (use `localhost`, not `127.0.0.1`). The session cookie is `SameSite=Lax`, and `localhost:5173` → `localhost:5000` counts as the same site. Mixing `127.0.0.1` and `localhost` makes it cross-site, so the cookie isn't sent.
4. Register a new account, or log in as `demo@menuo.app` / `demo1234` if you ran `npm run seed:demo`.

`VITE_USE_MOCK=true` (the default) keeps the frontend on its in-browser mock, which follows the same API contract. No backend is needed in that mode, and payments are disabled.

---

## 3. MongoDB Atlas setup

1. Sign in at <https://cloud.mongodb.com>, create a project, then **Create → Cluster**. The free **M0** tier is enough to start. Pick a region near your users, e.g. *Mumbai (ap-south-1)*.
2. **Database Access → Add New Database User**: choose *Password* authentication, generate a strong password, and give the user **Read and write to any database** (or a custom role limited to the `menuo` database).
3. **Network Access → Add IP Address**:
   - Development: *Add Current IP Address*.
   - Production: add your host's outbound IPs. Only use `0.0.0.0/0` if your host has no fixed IPs, and then rely on a long, unique database password.
4. **Connect → Drivers → Node.js** and copy the SRV string. Insert the database name before the `?`:
   ```
   mongodb+srv://menuo-app:<password>@cluster0.abcde.mongodb.net/menuo?retryWrites=true&w=majority
   ```
   URL-encode special characters in the password (`@` → `%40`, `#` → `%23`, …).
5. Put it in `MONGODB_URI` and start the server. Collections and indexes are created on startup: unique `email` and `slug`, and the menu, subscription, payment and webhook-event indexes. Startup syncs the indexes to the schema and drops indexes the schema doesn't declare, so give Menuo its own database.
6. Recommended: turn on Atlas backups (paid tiers) before you take real payments.

---

## 4. Razorpay sandbox (test mode) setup

> No Razorpay credentials were available while this was built. The integration is complete but has **only been tested against a mocked Razorpay API** in the automated tests. Run through the steps below in test mode before going live. Until the keys are set, checkout returns `503 PAYMENTS_NOT_CONFIGURED`. Nothing is ever simulated.

1. **Account & test mode:** sign up at <https://dashboard.razorpay.com> and switch the dashboard to **Test Mode**.
2. **API keys:** *Account & Settings → API Keys → Generate Test Key*. Copy them into:
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
   ```
   The secret stays on the server. Only the key id is sent to the browser.
3. **Plans:** *Subscriptions → Plans → Create Plan*. Create two monthly plans (billing every 1 month, INR) whose amounts **exactly match** `server/config/plans.js`:
   - Starter: **₹199**
   - Pro: **₹399**

   Copy their ids (`plan_…`):
   ```env
   RAZORPAY_PLAN_STARTER=plan_xxxxxxxxxxxx
   RAZORPAY_PLAN_PRO=plan_xxxxxxxxxxxx
   ```
   If you want GST on top, change both the Razorpay plan amounts and `config/plans.js` + `client/src/lib/constants.js`.
4. **Webhook:** *Account & Settings → Webhooks → Add New Webhook*:
   - URL: `https://<your-public-api>/api/webhooks/razorpay`
   - Secret: a long random string → `RAZORPAY_WEBHOOK_SECRET`
   - Active events: `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `subscription.paused`, `subscription.resumed`, `subscription.updated`, `payment.failed`

   Razorpay can't reach `localhost`. For local testing, expose the API with a tunnel such as `ngrok http 5000` or `cloudflared tunnel --url http://localhost:5000` and use the HTTPS URL it prints. Without a webhook, `POST /subscriptions/verify` still activates the plan by fetching the subscription from Razorpay, but renewals, failures and cancellations only arrive through webhooks.
5. **Restart the API.** It logs a warning if any payment variable is missing.
6. **Test a purchase:** in the app go to *Billing → Subscribe*. Razorpay Checkout opens. Pay with the test cards or test UPI ids from Razorpay's docs ("Test Card Details" / "Test UPI"; `success@razorpay` simulates a successful UPI payment). Then check:
   - The plan becomes *Active* in Billing, and *Payments* lists the charge.
   - *Webhooks* in the Razorpay dashboard shows `200` responses.
   - Re-sending a webhook from the dashboard returns `"duplicate": true` and changes nothing.
   - Cancelling in Menuo shows "won't renew", and Razorpay shows the subscription cancelling at cycle end.
7. **Going live:** complete Razorpay KYC and activate Subscriptions for live mode. Create the same two plans in live mode, generate live keys and a live webhook, and replace all five `RAZORPAY_*` values.

### How payment state is trusted

- `POST /subscriptions/checkout` only creates a Razorpay subscription. It grants nothing.
- After Checkout, the browser sends the payment id, subscription id and signature to `POST /subscriptions/verify`. The server checks the HMAC with the key secret, then **fetches the subscription from Razorpay** and applies whatever status Razorpay reports.
- Webhooks are verified against the raw request bytes with `RAZORPAY_WEBHOOK_SECRET` (timing-safe compare). They are de-duplicated by `X-Razorpay-Event-Id`, and stale (out-of-order) events are ignored.
- Payments store gateway ids, amount (paise), currency, status, method type and timestamps. No card numbers, CVV, UPI PINs or bank credentials ever reach this server, because Razorpay Checkout collects them directly.

---

## 5. Business rules

| Rule | Where |
|---|---|
| Starter ₹199/month, **50 items** max; Pro ₹399/month, unlimited | `config/plans.js`, enforced in `services/subscriptionService.js` (race-safe) |
| **7-day trial** (`TRIAL_DAYS`) for the owner's first restaurant only; never repeated for the same restaurant or owner | `createInitialSubscription` (atomic claim of `User.trialUsedAt`) |
| Statuses `trialing → active / past_due / cancelled / expired` | `computeAccess`, `syncLifecycle`, webhook mapping |
| No access → menu edits `402`, public menu offline (`404`); owners can still log in, view data, delete items and subscribe | menu & public controllers |
| `past_due` keeps the menu online for `PAYMENT_GRACE_DAYS` (3) while Razorpay retries | `computeAccess` |
| Cancel = at period end for paid plans (access kept), immediate for past-due | `cancelSubscription` |
| Plan change = new Razorpay subscription; the old one is cancelled when the new one activates (no proration) | `applyGatewaySubscription` |
| Menu slugs are generated once and are **permanent** | `Restaurant.slug` is `immutable`; `PATCH` rejects `slug` |
| Payments and subscriptions can't be deleted; deleting a restaurant **archives** it (slug stays reserved) | `models/plugins.js`, `archiveRestaurant` |

---

## 6. Security

- **Auth:** bcrypt (cost 12) password hashes, never returned (`select: false` + JSON transform). The JWT (HS256, issuer/audience pinned, 7 days) lives in an `HttpOnly` cookie: `Secure` in production, `SameSite` configurable. A password change bumps `tokenVersion`, which revokes all other sessions. Unknown emails still go through a bcrypt comparison, so response timing doesn't reveal which emails are registered.
- **CSRF:** double-submit token (`GET /auth/csrf` → `X-CSRF-Token` header) on every state-changing request, plus an `Origin` allow-list check.
- **CORS:** only `CLIENT_ORIGINS`, with credentials.
- **Validation:** strict Zod schemas on every body, query and param. Unknown fields are rejected, which blocks mass assignment. ObjectIds are validated, keys starting with `$` or containing `.` are stripped from input, and search text is regex-escaped.
- **Authorization:** every private lookup goes through `services/ownershipService.js`, so another owner's data is always `404`. Admin routes need `role: "admin"`, and admins can only be created from the CLI.
- **Rate limits** (per IP): all API traffic, failed logins, registrations/password changes, and the public menu.
- **Headers & errors:** Helmet defaults and `x-powered-by` off. Errors are always JSON without stack traces; internals are only logged on the server.
- **Limits:** JSON bodies ≤ `JSON_BODY_LIMIT` (2 MB), images ≤ ~1 MB, list pages ≤ 500 items (100 for admin), 10 restaurants per account, 200 categories per menu.

---

## 7. Deploying

**Vercel (recommended):** the repo deploys as one project, with the frontend and this API on the same domain. Setup steps are in the [root README](../README.md#deploy-on-vercel-frontend--api-in-one-project). There the API runs through `serverless.js` instead of `server.js`.

On any other host:

1. Serve the API over **HTTPS** and set `NODE_ENV=production`. The server refuses to start without secure cookies in production.
2. Set `TRUST_PROXY=1` behind Render/Railway/Heroku/Nginx so rate limits see real client IPs.
3. Set `CLIENT_ORIGINS=https://app.your-domain.com`.
4. **Cookies across domains:**
   - Recommended: put frontend and API on the same site, e.g. `app.menuo.in` + `api.menuo.in`, and keep `COOKIE_SAMESITE=lax`. Alternatively, proxy `/api` through the frontend host (Vercel rewrites, Netlify redirects, Nginx) so the API is same-origin.
   - Different sites (e.g. `*.vercel.app` + `*.onrender.com`) need `COOKIE_SAMESITE=none`. Browsers that block third-party cookies (Safari, and Chrome with tracking protection on) will then drop the session, so prefer the same-site setup.
5. Build the frontend with `VITE_USE_MOCK=false` and `VITE_API_URL=https://api.your-domain.com/api`, and configure SPA fallback so `/m/:slug` serves `index.html`.
6. If the frontend host sets a Content-Security-Policy, allow `https://checkout.razorpay.com` (script) and `https://api.razorpay.com` (frame/connect) for Checkout.
7. Create your admin: `npm run create-admin -- --email you@company.com`.

---

## 8. Project structure

```
server/
  app.js                 Express app: security middleware, routes, error handling
  server.js              Connects MongoDB, starts HTTP server, graceful shutdown
  config/                env.js (validated config), db.js, plans.js
  controllers/           auth, restaurant, menu (+ public menu), subscription (+ webhook), admin
  middleware/            auth, csrf, validate, sanitize, rateLimit, errorHandler
  models/                User, Restaurant, Category, MenuItem, Subscription, Payment, WebhookEvent, MenuView
  routes/                auth, restaurant, menu, public, subscription, webhook, admin
  services/              subscriptionService (trials, limits, lifecycle, webhooks),
                         paymentService (Razorpay REST + signatures), ownershipService
  validators/schemas.js  Zod schemas for every endpoint
  utils/                 generateSlug, ApiError, cookies, tokens, helpers
  scripts/               createAdmin.js, seedDemo.js
  tests/                 node:test + supertest + mongodb-memory-server
  docs/API.md            API reference
```

---

## 9. Tests

```bash
npm test
```

Tests use `node:test`, `supertest` and `mongodb-memory-server`. The first run downloads a MongoDB binary (~70 MB). Razorpay's REST API is replaced by an in-process fake, so no network is used. They cover:

- **auth:** HttpOnly cookie, no secrets in responses, duplicate email, validation, no self-assigned admin role, operator injection, CSRF token and origin, logout, password change revoking other sessions, rate-limited logins.
- **ownership:** every restaurant/menu/category/subscription endpoint returns 404 across owners, foreign category ids are rejected, mass assignment and slug changes are blocked.
- **subscriptions:** plan prices and limits, 7-day trial, no second trial, 50-item Starter limit (including parallel requests), Pro unlimited, expired trial blocks edits and takes the public menu offline, checkout without keys returns 503.
- **payments:** checkout grants nothing, forged signatures are rejected, verify trusts only Razorpay's state, webhook signature checks, idempotent duplicates, out-of-order events, failed payments, plan change, cancel at period end.
- **public menu:** only visible/available data and no private fields, live price updates. Also **admin** role checks, pagination and filters.

---

## 10. Checklist

### Implemented
- [x] Register / login / logout / `me`, bcrypt hashing, JWT in HttpOnly cookies, duplicate-email check, auth rate limiting
- [x] Profile and password change (revokes other sessions)
- [x] CSRF protection, CORS allow-list, Helmet, rate limiting, centralized JSON errors, NoSQL-injection guards, strict validation
- [x] Restaurants: create (unique permanent slug), list mine, get, update, archive, dashboard stats; ownership checks everywhere
- [x] Categories (create, edit, hide, reorder, delete with items) and menu items (create, edit, availability, duplicate, delete, category filter, search, pagination)
- [x] Public menu by slug with only published, visible, available data; view counter; no-cache so updates are instant
- [x] Starter/Pro plans, 7-day trial without repeats, 5 statuses, server-side limits and access checks
- [x] Razorpay Subscriptions: server-side checkout, signature verification, server-side status fetch, raw-body webhook verification, idempotency, failed payments, cancellation, plan change, expiry
- [x] Payment records without sensitive credentials; payments and subscriptions can't be deleted; restaurants are archived
- [x] Super-admin API (users, restaurants, subscriptions, payments, stats) with pagination, search and filters; CLI-only admin creation
- [x] Automated tests, `.env.example`, API docs, Atlas and Razorpay guides
- [x] React app updated to this contract: cookie auth + CSRF, `/restaurants`, `/menu`, `/subscriptions`, Razorpay Checkout, ₹199/₹399 plans, 7-day trial, onboarding, restaurant switcher, honest password-reset page

### Needs your configuration or is not built yet
- [ ] **Razorpay credentials + plans + webhook.** The integration is code-complete but untested against the real Razorpay sandbox (see section 4).
- [ ] **Email delivery** isn't configured, so there is no password reset, email verification or email-change confirmation. The "Forgot password" page says so and points to support. Razorpay emails customers about their subscription charges (`customer_notify`).
- [ ] **Image storage:** images are stored as compressed base64 data URLs inside MongoDB (max ~1 MB each). For production, upload them to S3/Cloudinary and store the URL; the API already accepts `https://` URLs.
- [ ] **Proration** on plan changes isn't implemented (the old plan is cancelled without a refund for unused days, and the UI says so).
- [ ] **GST invoices** aren't generated by Menuo; use Razorpay's invoices or add an invoicing service.
- [ ] **Admin UI:** the admin API exists, but there are no admin pages in the React app.
- [ ] **Delete restaurant** is available in the API only (no button in the UI yet).
- [ ] **Time-based status changes** (trial end, grace end) are applied whenever a subscription is read, not by a scheduled job. Admin lists show the stored status plus a computed `hasAccess`.
