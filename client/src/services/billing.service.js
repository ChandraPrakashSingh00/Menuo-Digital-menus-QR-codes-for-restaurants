import api from '../lib/api'

// Subscription summaries look like { subscription, plan, usage, paymentsEnabled }.
export const billingService = {
  plans: () => api.get('/subscriptions/plans').then((r) => r.data),
  current: (restaurantId) => api.get('/subscriptions/current', { params: { restaurantId } }).then((r) => r.data),
  payments: (restaurantId) => api.get('/subscriptions/payments', { params: { restaurantId } }).then((r) => r.data.payments),
  // Returns the Razorpay Checkout options; nothing is granted until the payment is verified.
  checkout: (restaurantId, plan) => api.post('/subscriptions/checkout', { restaurantId, plan }).then((r) => r.data.checkout),
  // `payment` is the object Razorpay Checkout passes to its success handler.
  verify: (restaurantId, payment) =>
    api
      .post('/subscriptions/verify', {
        restaurantId,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_subscription_id: payment.razorpay_subscription_id,
        razorpay_signature: payment.razorpay_signature,
      })
      .then((r) => r.data),
  cancel: (restaurantId) => api.post('/subscriptions/cancel', { restaurantId }).then((r) => r.data),
}
