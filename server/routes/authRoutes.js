import { Router } from 'express'
import { changePassword, csrfToken, login, logout, me, register, updateProfile } from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'
import { loginLimiter, sensitiveAuthLimiter } from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import { loginBody, passwordBody, profileBody, registerBody } from '../validators/schemas.js'

const router = Router()

router.get('/csrf', csrfToken)
router.post('/register', sensitiveAuthLimiter, validate({ body: registerBody }), register)
router.post('/login', loginLimiter, validate({ body: loginBody }), login)
router.post('/logout', logout)
router.get('/me', requireAuth, me)
router.patch('/profile', requireAuth, validate({ body: profileBody }), updateProfile)
router.patch('/password', requireAuth, sensitiveAuthLimiter, validate({ body: passwordBody }), changePassword)

export default router
