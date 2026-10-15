import mongoose from 'mongoose'
import { toJSONPlugin } from './plugins.js'

export const USER_ROLES = ['owner', 'admin']

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'owner', index: true },
    // Bumped on password change so every previously issued session token stops working.
    tokenVersion: { type: Number, default: 0, select: false },
    // Set the first time one of this owner's restaurants starts a free trial (one trial per owner).
    trialUsedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
)

userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ createdAt: -1 })

toJSONPlugin(userSchema, { hide: ['passwordHash', 'tokenVersion'] })

export const User = mongoose.models.User || mongoose.model('User', userSchema)
export default User
