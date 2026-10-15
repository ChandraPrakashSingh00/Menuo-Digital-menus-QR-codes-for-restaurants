import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'

const ISSUER = 'menuo-api'
const AUDIENCE = 'menuo-app'

export function signAuthToken(user) {
  return jwt.sign({ tv: user.tokenVersion, role: user.role }, config.jwt.secret, {
    algorithm: 'HS256',
    subject: String(user._id),
    expiresIn: `${config.jwt.expiresDays}d`,
    issuer: ISSUER,
    audience: AUDIENCE,
  })
}

export function verifyAuthToken(token) {
  return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE })
}
