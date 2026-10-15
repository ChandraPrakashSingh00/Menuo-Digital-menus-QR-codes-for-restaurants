import { config } from './config/env.js'
import { connectDB, disconnectDB } from './config/db.js'
import app from './app.js'
import { isConfigured as paymentsConfigured, isWebhookConfigured } from './services/paymentService.js'

try {
  await connectDB(config.mongoUri)
  console.info('[db] Connected to MongoDB')
} catch (error) {
  console.error('[db] Could not connect to MongoDB:', error.message)
  process.exit(1)
}

if (!paymentsConfigured()) {
  console.warn('[billing] Razorpay is not configured — checkout returns 503 until RAZORPAY_* variables are set.')
} else if (!isWebhookConfigured()) {
  console.warn('[billing] RAZORPAY_WEBHOOK_SECRET is missing — payment webhooks will be rejected.')
}

const server = app.listen(config.port, () => {
  console.info(`[api] Menuo API listening on http://localhost:${config.port} (${config.env})`)
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.info(`[api] ${signal} received, shutting down…`)
  server.close(async () => {
    await disconnectDB().catch(() => {})
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', (reason) => {
  console.error('[api] Unhandled promise rejection:', reason)
})
