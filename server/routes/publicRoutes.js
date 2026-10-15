import { Router } from 'express'
import { getPublicMenu, recordMenuView } from '../controllers/menuController.js'
import { publicLimiter } from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import { slugParams } from '../validators/schemas.js'

const router = Router()

router.use(publicLimiter)

router.get('/menu/:slug', validate({ params: slugParams }), getPublicMenu)
router.post('/menu/:slug/views', validate({ params: slugParams }), recordMenuView)

export default router
