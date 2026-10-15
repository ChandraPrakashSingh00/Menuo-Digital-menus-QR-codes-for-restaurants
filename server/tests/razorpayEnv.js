// Test-mode Razorpay configuration. Imported before helpers.js so config/env.js sees it.
process.env.RAZORPAY_KEY_ID = 'rzp_test_key123'
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret_123'
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_123'
process.env.RAZORPAY_PLAN_STARTER = 'plan_starterTEST01'
process.env.RAZORPAY_PLAN_PRO = 'plan_proTEST01'
