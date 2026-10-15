// Creates a super admin, or promotes an existing account to admin.
// There is deliberately no HTTP route for this — run it from a trusted shell.
//
//   Promote an existing user:
//     npm run create-admin -- --email you@company.com
//
//   Create a new admin (password via environment variable, never as an argument):
//     ADMIN_PASSWORD='a-long-unique-password' npm run create-admin -- --email you@company.com --name "Your Name"

import { parseArgs } from 'node:util'
import bcrypt from 'bcryptjs'
import { config } from '../config/env.js'
import { connectDB, disconnectDB } from '../config/db.js'
import User from '../models/User.js'

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string', default: 'Menuo Admin' },
  },
})

const email = values.email?.trim().toLowerCase()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run create-admin -- --email you@company.com [--name "Your Name"]')
  process.exit(1)
}

await connectDB(config.mongoUri)
try {
  const existing = await User.findOne({ email })
  if (existing) {
    existing.role = 'admin'
    await existing.save()
    console.info(`Promoted ${email} to admin.`)
  } else {
    const password = process.env.ADMIN_PASSWORD
    if (!password || password.length < 12 || Buffer.byteLength(password) > 72) {
      console.error('No account with that email. Set ADMIN_PASSWORD (12–72 characters) to create one.')
      process.exitCode = 1
    } else {
      await User.create({ name: values.name, email, role: 'admin', passwordHash: await bcrypt.hash(password, 12) })
      console.info(`Created admin account ${email}.`)
    }
  }
} finally {
  await disconnectDB()
}
