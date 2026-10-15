// Single source of truth for plan pricing and limits.
// Amounts are in paise (₹1 = 100 paise), the unit Razorpay uses.
// Keep client/src/lib/constants.js in sync for marketing copy.

export const PLAN_IDS = ['starter', 'pro']

export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    amount: 19900,
    currency: 'INR',
    interval: 'monthly',
    itemLimit: 50,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    amount: 39900,
    currency: 'INR',
    interval: 'monthly',
    itemLimit: null, // unlimited
  },
}

export function getPlan(planId) {
  return PLANS[planId] || PLANS.starter
}

export function publicPlan(planId) {
  const plan = getPlan(planId)
  return { ...plan, price: plan.amount / 100 }
}
