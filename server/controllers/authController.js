import bcrypt from 'bcryptjs'
import { config } from '../config/env.js'
import { issueCsrfToken } from '../middleware/csrf.js'
import User from '../models/User.js'
import { ApiError } from '../utils/ApiError.js'
import { clearAuthCookie, setAuthCookie } from '../utils/cookies.js'
import { isDuplicateKeyError } from '../utils/helpers.js'
import { signAuthToken } from '../utils/tokens.js'

const BCRYPT_ROUNDS = config.isTest ? 4 : 12
// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('menuo-timing-equaliser', BCRYPT_ROUNDS)

const emailTaken = () =>
  ApiError.conflict('An account with this email already exists.', { code: 'EMAIL_TAKEN', errors: { email: 'Email already registered' } })

function startSession(res, user) {
  setAuthCookie(res, signAuthToken(user))
}

/** GET /api/auth/csrf */
export function csrfToken(req, res) {
  res.json({ csrfToken: issueCsrfToken(req, res) })
}

/** POST /api/auth/register */
export async function register(req, res) {
  const { name, email, password } = req.valid.body
  if (await User.exists({ email })) throw emailTaken()

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  let user
  try {
    user = await User.create({ name, email, passwordHash })
  } catch (error) {
    if (isDuplicateKeyError(error)) throw emailTaken()
    throw error
  }

  startSession(res, user)
  res.status(201).json({ user })
}

/** POST /api/auth/login */
export async function login(req, res) {
  const { email, password } = req.valid.body
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion')
  const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH)
  if (!user || !valid) throw ApiError.unauthorized('Incorrect email or password.', { code: 'INVALID_CREDENTIALS' })

  user.lastLoginAt = new Date()
  await user.save()
  startSession(res, user)
  res.json({ user })
}

/** POST /api/auth/logout */
export function logout(req, res) {
  clearAuthCookie(res)
  res.json({ message: 'Logged out.' })
}

/** GET /api/auth/me */
export function me(req, res) {
  res.json({ user: req.user })
}

/** PATCH /api/auth/profile */
export async function updateProfile(req, res) {
  const { name, email } = req.valid.body
  if (email && email !== req.user.email && (await User.exists({ email, _id: { $ne: req.user._id } }))) throw emailTaken()

  if (name !== undefined) req.user.name = name
  if (email !== undefined) req.user.email = email
  try {
    await req.user.save()
  } catch (error) {
    if (isDuplicateKeyError(error)) throw emailTaken()
    throw error
  }
  res.json({ user: req.user })
}

/** PATCH /api/auth/password — also signs out every other session. */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body
  const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion')
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    // 400, not 401: a wrong password here must not log the user out of the app.
    throw ApiError.badRequest('Current password is incorrect.', { code: 'INVALID_PASSWORD', errors: { currentPassword: 'Incorrect password' } })
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  user.tokenVersion += 1
  await user.save()
  startSession(res, user)
  res.json({ message: 'Password updated. You have been signed out on other devices.' })
}
