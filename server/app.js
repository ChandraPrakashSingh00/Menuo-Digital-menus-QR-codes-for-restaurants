import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import { config } from './config/env.js'
import { csrfProtection, isAllowedOrigin } from './middleware/csrf.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { apiLimiter } from './middleware/rateLimit.js'
import { sanitizeInput } from './middleware/sanitize.js'
import adminRoutes from './routes/adminRoutes.js'
import authRoutes from './routes/authRoutes.js'
import menuRoutes from './routes/menuRoutes.js'
import publicRoutes from './routes/publicRoutes.js'
import restaurantRoutes from './routes/restaurantRoutes.js'
import subscriptionRoutes from './routes/subscriptionRoutes.js'
import webhookRoutes from './routes/webhookRoutes.js'

const app = express()

app.disable('x-powered-by')
// Number of reverse proxies in front of the app (Render, Railway, Nginx …) so req.ip and
// rate limiting see the real client address. 0 when the app is reached directly.
app.set('trust proxy', config.trustProxy)

app.use(helmet())
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    maxAge: 600,
  }),
)

// Webhooks need the raw body for signature checks, so they are mounted before express.json().
app.use('/api/webhooks', webhookRoutes)

app.use(express.json({ limit: config.jsonBodyLimit }))
app.use(cookieParser())
app.use(sanitizeInput)
app.use('/api', apiLimiter)
app.use(csrfProtection)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
})

app.use('/api/auth', authRoutes)
app.use('/api/restaurants', restaurantRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/admin', adminRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
