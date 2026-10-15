# Menuo API reference

Base URL: `http://localhost:5000/api` in development (or whatever `VITE_API_URL` points to).

## Conventions

- **JSON everywhere.** Successful responses are objects keyed by resource (`{ user }`, `{ restaurant }`, `{ items, pagination }`).
- **Errors** always look like this:

  ```json
  { "message": "Price cannot be negative", "code": "VALIDATION_ERROR", "errors": { "price": "Price cannot be negative" } }
  ```

  `message` is safe to show to users. `code` is stable and meant for code. `errors` maps fields to messages and appears only for validation errors.

- **Authentication** uses an HttpOnly cookie named `menuo_session` that the API sets on login/register. Browsers send it automatically when requests are made with credentials (`axios` `withCredentials: true`, `fetch` `credentials: 'include'`). No token is ever returned in a response body.
- **CSRF:** every `POST`, `PUT`, `PATCH` and `DELETE` (except `/api/public/*` and `/api/webhooks/*`) must send the header `X-CSRF-Token`. Get the token from `GET /api/auth/csrf`. A missing or stale token returns `403 CSRF_INVALID`; fetch a new token and retry. Requests whose `Origin` is not in `CLIENT_ORIGINS` are rejected with `403 CSRF_ORIGIN`.
- **IDs** are 24-character hex strings. A malformed ID returns `400`. A valid ID that belongs to another owner returns `404`, the same as one that doesn't exist.
- **Request bodies are strict:** unknown fields are rejected with `400` (`"errors": { "slug": "Unknown field" }`). This blocks mass assignment of fields such as `ownerId`, `role` or `slug`.
- **Pagination** (list endpoints): `?page=1&limit=20` → `"pagination": { "page": 1, "limit": 20, "total": 57, "pages": 3 }`.
- **Prices** are numbers in the restaurant's currency (e.g. `289` or `149.5`), rounded to 2 decimals. **Payment amounts** are integers in paise (`39900` = ₹399).

### Common error codes

| Status | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_ID`, `INVALID_JSON`, `INVALID_CATEGORY`, `INVALID_SIGNATURE`, `PAYMENT_MISMATCH` | Bad input |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | Not logged in / session expired / wrong password |
| 402 | `SUBSCRIPTION_INACTIVE` | Trial or subscription has ended; subscribe to edit the menu |
| 403 | `FORBIDDEN`, `PLAN_LIMIT_REACHED`, `CSRF_INVALID`, `CSRF_ORIGIN`, `RESTAURANT_LIMIT` | Not allowed |
| 404 | `NOT_FOUND`, `MENU_UNAVAILABLE` | Missing, or owned by someone else |
| 409 | `EMAIL_TAKEN`, `ALREADY_SUBSCRIBED`, `NOTHING_TO_CANCEL`, `SUBSCRIPTION_ACTIVE` | Conflicts with current state |
| 413 | `PAYLOAD_TOO_LARGE` | Body over `JSON_BODY_LIMIT` |
| 429 | `RATE_LIMITED` | Too many requests |
| 502/503 | `PAYMENT_PROVIDER_ERROR`, `PAYMENTS_NOT_CONFIGURED` | Razorpay unreachable / not configured |
| 500 | `INTERNAL_ERROR` | Unexpected error (details are only in server logs) |

---

## Auth

### `GET /auth/csrf`
Returns a CSRF token and sets the matching cookie.
```json
200 { "csrfToken": "7f72f15394da…" }
```

### `POST /auth/register`
Rate limited (`AUTH_RATE_LIMIT_MAX` per IP per hour).
```http
POST /api/auth/register
X-CSRF-Token: <token>

{ "name": "Aarav Mehta", "email": "aarav@example.com", "password": "at-least-8-chars" }
```
```json
201 Set-Cookie: menuo_session=…; HttpOnly; SameSite=Lax
{
  "user": {
    "id": "6acf67e08b06f296695581b8",
    "name": "Aarav Mehta",
    "email": "aarav@example.com",
    "role": "owner",
    "trialUsedAt": null,
    "lastLoginAt": null,
    "createdAt": "2026-10-14T11:30:40.917Z",
    "updatedAt": "2026-10-14T11:30:40.917Z"
  }
}
```
Errors: `400 VALIDATION_ERROR` (name 2–80 chars, valid email, password 8–72 chars), `409 EMAIL_TAKEN`.
Registering creates only the user. Create the restaurant next with `POST /restaurants`.

### `POST /auth/login`
Failed attempts are rate limited (`AUTH_RATE_LIMIT_MAX` per IP per 15 min).
```json
{ "email": "aarav@example.com", "password": "at-least-8-chars" }
→ 200 { "user": { … } }        401 { "message": "Incorrect email or password.", "code": "INVALID_CREDENTIALS" }
```

### `POST /auth/logout`
Clears the session cookie. `200 { "message": "Logged out." }`

### `GET /auth/me`
`200 { "user": { … } }` or `401 UNAUTHENTICATED`. Use it on app start to restore the session.

### `PATCH /auth/profile` (auth)
`{ "name"?: string, "email"?: string }` → `200 { "user" }`. `409 EMAIL_TAKEN` if the email belongs to another account. Email changes are not verified because email delivery isn't configured.

### `PATCH /auth/password` (auth)
`{ "currentPassword": "…", "newPassword": "…" }` → `200 { "message": "Password updated. You have been signed out on other devices." }`.
A wrong current password returns `400 INVALID_PASSWORD`, not 401, so the app doesn't log the user out. Every other session is revoked, and this one gets a fresh cookie.

> There is **no password-reset or email-verification endpoint**. Both need an email provider, which isn't configured. See the README checklist.

---

## Restaurants (auth)

Restaurant object:
```json
{
  "id": "6acf67e08b06f296695581b9",
  "name": "The Spice Route",
  "slug": "spice-route",
  "logo": "",
  "cover": "",
  "brandColor": "#DC2626",
  "description": "Family-run kitchen…",
  "cuisine": "North Indian · Mughlai",
  "address": "14, Linking Road, Bandra West, Mumbai",
  "phone": "+91 98200 12345",
  "email": "",
  "openingHours": "12:00 PM – 11:30 PM",
  "currency": "INR",
  "isPublished": true,
  "createdAt": "…",
  "updatedAt": "…"
}
```
- `slug` is generated from the name on creation (`the-spice-route`, then `-2`, `-3` … if taken) and **can never change**: printed QR codes point at `/m/<slug>`.
- `logo`, `cover`: `""`, an `http(s)` URL, or a base64 `data:image/png|jpeg|webp|gif` URL up to ~1 MB.
- `email` is the restaurant's private contact address. It is never shown on the public menu.
- `currency`: `INR | USD | EUR | GBP | AED` (display only; subscriptions are always billed in INR).

### `GET /restaurants/mine`
`200 { "restaurants": [Restaurant] }` — only the caller's restaurants that haven't been deleted, oldest first.

### `POST /restaurants`
```json
{ "name": "The Spice Route", "plan": "starter" }
```
Every restaurant field above except `slug` is accepted. `plan` (`starter` | `pro`, default `starter`) is the plan to trial.
```json
201 { "restaurant": { … }, "subscription": { "status": "trialing", "trialEndsAt": "…", … } }
```
The owner's **first** restaurant gets a `TRIAL_DAYS` (7) day trial. Later restaurants, or owners who already used their trial, start with `status: "expired"` and must subscribe. Limit: 10 restaurants per account (`403 RESTAURANT_LIMIT`).

### `GET /restaurants/:id`
`200 { "restaurant" }`

### `PATCH /restaurants/:id`
Any subset of the fields above except `slug`:
```json
{ "openingHours": "11 AM – 11 PM", "isPublished": false }
→ 200 { "restaurant": { … } }
```

### `DELETE /restaurants/:id`
Archives the restaurant. It is unpublished and hidden from `/mine`, the slug stays reserved, and payment records are kept. Returns `409 SUBSCRIPTION_ACTIVE` while a paid subscription is still renewing (cancel it first).
`200 { "message": "Restaurant deleted.", "id": "…" }`

### `GET /restaurants/:id/stats`
```json
200 {
  "totals": { "items": 8, "availableItems": 8, "categories": 3, "views7d": 41, "viewsChange": 12, "viewsTotal": 380 },
  "viewsByDay": [{ "date": "2026-10-01", "count": 3 }, … 14 days …],
  "recentItems": [MenuItem, … up to 5]
}
```
`viewsChange` is the % change against the previous 7 days, or `null` when there is no previous data. Days are in `ANALYTICS_TIMEZONE`.

---

## Menu (auth, restaurant owner only)

Every endpoint checks that the restaurant, item or category belongs to the caller.
**Creating or editing** items and categories needs an active trial or subscription (`402 SUBSCRIPTION_INACTIVE` otherwise). **Deleting** is always allowed.

MenuItem object:
```json
{
  "id": "…",
  "restaurantId": "…",
  "categoryId": "…",
  "category": "Starters",
  "name": "Paneer Tikka",
  "description": "Cottage cheese cubes…",
  "price": 289,
  "imageUrl": "",
  "tags": ["veg", "bestseller"],
  "isAvailable": true,
  "isFeatured": true,
  "sortOrder": 0,
  "createdAt": "…",
  "updatedAt": "…"
}
```
`tags` ⊂ `veg, non-veg, vegan, spicy, gluten-free, bestseller`. `price` is 0 – 1,000,000. `name` is 1–80 chars and `description` up to 300.

### `GET /menu/:restaurantId`
Query: `categoryId`, `search` (name/description, case-insensitive, matched literally), `available=true|false`, `page`, `limit` (≤ 500, default 100).
```http
GET /api/menu/6acf…b9?categoryId=6acf…c0&search=paneer&available=true&page=1&limit=50
```
```json
200 { "items": [MenuItem], "pagination": { "page": 1, "limit": 50, "total": 1, "pages": 1 } }
```

### `POST /menu/:restaurantId`
```json
{ "categoryId": "6acf…c0", "name": "Paneer Tikka", "price": 289, "description": "…", "imageUrl": "", "tags": ["veg"], "isAvailable": true, "isFeatured": false }
→ 201 { "item": MenuItem }
```
`categoryId`, `name` and `price` are required. Errors: `400 INVALID_CATEGORY` (category of another restaurant), `402 SUBSCRIPTION_INACTIVE`, `403 PLAN_LIMIT_REACHED` (Starter: 50 items):
```json
403 { "message": "Your Starter plan allows up to 50 menu items. Upgrade to Pro for unlimited items.", "code": "PLAN_LIMIT_REACHED" }
```
The limit is enforced on the server and is race-safe: parallel requests can't push a restaurant past it.

### `PATCH /menu/item/:id`
Any subset of item fields. For example, toggling availability or changing the price:
```json
{ "isAvailable": false }        { "price": 249 }
→ 200 { "item": MenuItem }
```
Changes appear on the public menu on the next request.

### `DELETE /menu/item/:id`
`200 { "message": "Item deleted.", "id": "…" }`

### `POST /menu/item/:id/duplicate`
`201 { "item": MenuItem }` — named "… (copy)". Counts toward the plan limit.

### Categories
Category object: `{ "id", "restaurantId", "name", "description", "isVisible", "sortOrder", "itemCount", "createdAt", "updatedAt" }`

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/menu/:restaurantId/categories` | — | `200 { categories }` (sorted, with `itemCount`) |
| POST | `/menu/:restaurantId/categories` | `{ name, description?, isVisible?, sortOrder? }` | `201 { category }` |
| PATCH | `/menu/category/:id` | any subset | `200 { category }` |
| DELETE | `/menu/category/:id` | — | `200 { message, id, deletedItems }`, which **also deletes its items** |
| PUT | `/menu/:restaurantId/categories/order` | `{ ids: [id, …] }` in the new order | `200 { categories }` |

Hidden categories (`isVisible: false`) and their items stay saved but don't appear on the public menu.

---

## Public menu (no login)

### `GET /public/menu/:slug`
Rate limited per IP. Returns `Cache-Control: no-cache`, so price changes show on the next scan of the same QR code.
```json
200 {
  "restaurant": {
    "name": "The Spice Route", "slug": "spice-route", "logo": "", "cover": "", "brandColor": "#DC2626",
    "description": "…", "cuisine": "…", "address": "…", "phone": "+91 98200 12345",
    "openingHours": "12:00 PM – 11:30 PM", "currency": "INR"
  },
  "categories": [{ "id": "…", "name": "Starters", "description": "…", "sortOrder": 0 }],
  "items": [{ "id": "…", "categoryId": "…", "name": "Paneer Tikka", "description": "…", "price": 289, "imageUrl": "",
              "tags": ["veg"], "isAvailable": true, "isFeatured": true, "sortOrder": 0 }],
  "showBranding": false
}
```
- Only **published** restaurants with an **active trial or subscription** are served. Otherwise the response is `404 { "code": "MENU_UNAVAILABLE", "message": "This menu is not available right now." }`.
- Only visible categories and **available** items are returned.
- Never included: owner id/name/email, the restaurant's private email, the restaurant id, subscription or payment data.
- `showBranding` is `true` on the Starter plan (shows a small "Menuo" badge).

### `POST /public/menu/:slug/views`
Counts one menu view for the day. The React app sends it once per browser session. `200 { "recorded": true }`. No CSRF token needed.

---

## Subscriptions

Subscription object (as returned by the API):
```json
{
  "id": "…",
  "restaurantId": "…",
  "plan": "pro",
  "status": "trialing",
  "hasAccess": true,
  "trialUsed": true,
  "trialStartedAt": "2026-10-14T11:30:40.936Z",
  "trialEndsAt": "2026-10-21T11:30:40.936Z",
  "currentPeriodStart": null,
  "currentPeriodEnd": null,
  "cancelAtPeriodEnd": false,
  "cancelledAt": null,
  "isPaid": false,
  "pendingPlan": null,
  "updatedAt": "…"
}
```

| `status` | Meaning | `hasAccess` |
|---|---|---|
| `trialing` | Free trial running | until `trialEndsAt` |
| `active` | Paid and renewing | yes, plus `PAYMENT_GRACE_DAYS` after `currentPeriodEnd` while waiting for the renewal |
| `past_due` | Renewal charge failed; Razorpay is retrying | until `currentPeriodEnd` + grace |
| `cancelled` | Cancelled | until `currentPeriodEnd` (time already paid for is honoured) |
| `expired` | Trial over, or never subscribed | no |

`hasAccess: false` means menu edits return `402` and the public menu returns `404`. Status changes that depend on time (trial ending, grace running out) are applied the next time the subscription is read.

### `GET /subscriptions/plans` (public)
```json
200 {
  "plans": [
    { "id": "starter", "name": "Starter", "amount": 19900, "price": 199, "currency": "INR", "interval": "monthly", "itemLimit": 50 },
    { "id": "pro", "name": "Pro", "amount": 39900, "price": 399, "currency": "INR", "interval": "monthly", "itemLimit": null }
  ],
  "trialDays": 7,
  "paymentsEnabled": false
}
```

### `GET /subscriptions/current?restaurantId=…` (auth)
```json
200 {
  "subscription": { … },
  "plan": { "id": "pro", "name": "Pro", "amount": 39900, "price": 399, "currency": "INR", "interval": "monthly", "itemLimit": null },
  "usage": { "items": 8, "itemLimit": null },
  "paymentsEnabled": true
}
```

### `GET /subscriptions/payments?restaurantId=…&page=&limit=` (auth)
```json
200 {
  "payments": [{
    "id": "…", "plan": "pro", "amount": 39900, "currency": "INR", "status": "captured", "method": "upi",
    "gatewayPaymentId": "pay_…", "gatewayInvoiceId": "inv_…", "errorDescription": null,
    "paidAt": "…", "createdAt": "…"
  }],
  "pagination": { … }
}
```
`status`: `created | authorized | captured | failed | refunded`. Card numbers, CVV and UPI credentials are never received or stored.

### `POST /subscriptions/checkout` (auth)
```json
{ "restaurantId": "…", "plan": "pro" }
→ 201 {
  "checkout": {
    "provider": "razorpay",
    "keyId": "rzp_test_…",
    "subscriptionId": "sub_…",
    "plan": "pro",
    "amount": 39900,
    "currency": "INR",
    "name": "Menuo",
    "description": "Pro plan · billed monthly",
    "prefill": { "name": "Aarav Mehta", "email": "aarav@example.com" }
  }
}
```
This creates a Razorpay subscription and **grants nothing yet**. Open Razorpay Checkout with `key` = `keyId` and `subscription_id` = `subscriptionId`.
Errors: `503 PAYMENTS_NOT_CONFIGURED` (no Razorpay keys or plan ids), `409 ALREADY_SUBSCRIBED`, `502 PAYMENT_PROVIDER_ERROR`.

### `POST /subscriptions/verify` (auth)
Send the object Razorpay Checkout passes to its `handler`:
```json
{
  "restaurantId": "…",
  "razorpay_payment_id": "pay_…",
  "razorpay_subscription_id": "sub_…",
  "razorpay_signature": "hex…"
}
→ 200 { "subscription", "plan", "usage", "paymentsEnabled" }
```
The server checks `HMAC_SHA256(payment_id + "|" + subscription_id, key_secret)`, then **fetches the subscription from Razorpay** and applies the status Razorpay reports. A browser "success" alone never activates a plan. If Razorpay hasn't marked the subscription active yet, the response still shows the old plan, and the webhook finishes the activation a few seconds later. Errors: `400 INVALID_SIGNATURE`, `400 PAYMENT_MISMATCH`.

### `POST /subscriptions/cancel` (auth)
`{ "restaurantId": "…" }` → `200 { "subscription", … }`
- Paid and active: cancelled at Razorpay **at the end of the cycle** (`cancelAtPeriodEnd: true`), with access until then.
- Past due: cancelled immediately.
- Trial: `status: "cancelled"`, with access until the trial would have ended.
- Otherwise: `409 NOTHING_TO_CANCEL`.

**Changing plan:** call `checkout` with the other plan. When the new subscription becomes active, the old one is cancelled at Razorpay immediately. There is no proration, so unused days of the old plan are not refunded.

---

## Webhooks

### `POST /webhooks/razorpay`
Configure this URL in the Razorpay dashboard (see README). It must receive the **raw body**: the route uses `express.raw()` and is mounted before `express.json()`.
- `X-Razorpay-Signature` is verified as `HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)` with a timing-safe compare. An invalid signature gets `400`.
- `X-Razorpay-Event-Id` makes processing idempotent: a repeated delivery gets `200 { "received": true, "duplicate": true }` and is not applied again. A delivery that failed earlier is processed again on retry.
- Events older than the last one applied to a subscription are ignored, so out-of-order delivery can't undo a newer state.

| Event | Effect |
|---|---|
| `subscription.activated`, `subscription.charged`, `subscription.resumed` | status → `active`, period dates from Razorpay, payment recorded (on `charged`) |
| `subscription.pending`, `subscription.halted`, `subscription.paused` | status → `past_due` |
| `subscription.cancelled` | status → `cancelled` |
| `subscription.completed` | status → `expired` |
| `subscription.authenticated`, `subscription.updated` | period/plan details synced, status unchanged |
| `payment.failed`, `payment.captured` | payment recorded, if it can be linked to one of our subscriptions |

Responses: `200 { "received": true, "duplicate": false }`. `503` if `RAZORPAY_WEBHOOK_SECRET` is missing. `500` if processing fails, so that Razorpay retries.

---

## Admin (auth, `role: "admin"`)

Normal owners get `403 FORBIDDEN` on every admin route. Admin accounts are created only with `npm run create-admin` (there is no sign-up route for them).

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/admin/stats` | — | `{ users, restaurants, subscriptions: { trialing: n, active: n, … }, revenue: [{ currency, amount, payments }] }` |
| GET | `/admin/users` | `page, limit (≤100), search (name/email), role=owner\|admin` | `{ users, pagination }` |
| GET | `/admin/restaurants` | `page, limit, search (name/slug), status=published\|unpublished\|archived` | `{ restaurants (with owner {id,name,email}), pagination }` |
| GET | `/admin/subscriptions` | `page, limit, search (restaurant name/slug), status, plan` | `{ subscriptions (with restaurant, hasAccess), pagination }` |
| GET | `/admin/payments` | `page, limit, search (exact pay_/sub_ id), status` | `{ payments (with restaurant), pagination }` |

---

## Health

`GET /health` → `200 { "status": "ok", "database": "connected" }`
