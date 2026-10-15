export const APP_NAME = 'Menuo'

export const QR_DOWNLOADED_KEY = 'menuo_qr_downloaded'

export const CURRENCIES = [
  { value: 'INR', label: 'Indian Rupee (₹)' },
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'AED', label: 'UAE Dirham (AED)' },
]

export const DIETARY_TAGS = [
  { value: 'veg', label: 'Veg', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { value: 'non-veg', label: 'Non-veg', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  { value: 'vegan', label: 'Vegan', className: 'bg-lime-50 text-lime-700 ring-lime-200' },
  { value: 'spicy', label: 'Spicy', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { value: 'gluten-free', label: 'Gluten-free', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { value: 'bestseller', label: 'Bestseller', className: 'bg-primary-50 text-primary-700 ring-primary-200' },
]

// Matches the API's default (server/models/Restaurant.js).
export const DEFAULT_BRAND_COLOR = '#05805F'

export const BRAND_COLORS = [DEFAULT_BRAND_COLOR, '#071C23', '#DC2626', '#EA580C', '#CA8A04', '#0D9488', '#2563EB', '#7C3AED']

// Prices and limits are enforced by the API (server/config/plans.js) — keep these in sync.
export const TRIAL_DAYS = 7

export const SUPPORT_EMAIL = 'hello@menuo.app'

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For cafés, food trucks and compact menus.',
    price: 199,
    limits: { items: 50 },
    features: ['Up to 50 menu items', 'QR code & shareable menu link', 'Logo, cover photo & brand colour', 'Menu view analytics'],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For full-service restaurants with big menus.',
    price: 399,
    limits: { items: Infinity },
    popular: true,
    features: ['Unlimited menu items', 'Everything in Starter', 'No Menuo badge on your menu'],
  },
]

/** The free trial shown next to the paid plans. It is not a plan of its own: it unlocks the chosen plan. */
export const TRIAL_CARD = {
  id: 'trial',
  name: 'Free Trial',
  features: ['Full access to your chosen plan', 'No credit card required', 'Your first restaurant only'],
}

export function getPlan(planId) {
  return PLANS.find((plan) => plan.id === planId) || PLANS[0]
}
