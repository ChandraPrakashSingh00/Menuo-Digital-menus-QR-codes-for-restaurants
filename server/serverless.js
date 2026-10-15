import express from 'express'
import { config } from './config/env.js'
import { connectDB } from './config/db.js'
import app from './app.js'

// Serverless entry (Vercel, see ../api/index.js). Instead of server.js's connect-then-listen,
// the MongoDB connection is opened by the first request and reused while the instance stays warm.
// The default export is an Express app on purpose: Vercel hands an app (anything with .listen)
// the untouched request stream, so the Razorpay webhook still gets its raw body.

let connecting = null

function ensureDatabase() {
  connecting ??= connectDB(config.mongoUri).catch((error) => {
    connecting = null // let the next request retry
    throw error
  })
  return connecting
}

const handler = express()
handler.disable('x-powered-by')

handler.use(async (req, res, next) => {
  try {
    await ensureDatabase()
    next()
  } catch (error) {
    console.error('[db] Could not connect to MongoDB:', error.message)
    res.status(503).json({ message: 'The service is temporarily unavailable. Please try again shortly.', code: 'DB_UNAVAILABLE' })
  }
})
handler.use(app)

export default handler
