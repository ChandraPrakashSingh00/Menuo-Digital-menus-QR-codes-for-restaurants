import express, { Router } from 'express'
import { razorpayWebhook } from '../controllers/subscriptionController.js'

const router = Router()

// Razorpay signs the exact bytes it sends, so this route reads the raw body as a Buffer.
// It is mounted in app.js before express.json() for that reason.
router.post('/razorpay', express.raw({ type: '*/*', limit: '1mb' }), razorpayWebhook)

export default router
