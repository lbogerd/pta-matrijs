import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import { pool } from './db'
const ac = createAccessControl({ user: ['create','list','set-password'], session: ['list','revoke'] } as const)
export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.BETTER_AUTH_URL || 'http://localhost:3000'],
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
  session: { expiresIn: 60 * 60 * 12, cookieCache: { enabled: false } },
  plugins: [admin({ defaultRole: 'teacher', adminRoles: ['admin'], ac, roles: {
    admin: ac.newRole({ user: ['create','list','set-password'], session: ['list','revoke'] }),
    teacher: ac.newRole({}), committee: ac.newRole({}), office: ac.newRole({}),
  } })],
})
