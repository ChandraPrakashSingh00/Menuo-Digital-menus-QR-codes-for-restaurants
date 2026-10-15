// Vercel function: vercel.json rewrites /api/* here, so the Express API in server/ runs on the
// same domain as the React app and the session cookie stays first-party.
export { default } from '../server/serverless.js'
