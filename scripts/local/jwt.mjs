#!/usr/bin/env node
// Prints an HS256 API key JWT (like Supabase's anon / service_role keys).
// Usage: node scripts/local/jwt.mjs <secret> <role>
import { createHmac } from 'node:crypto';

const [secret, role = 'anon'] = process.argv.slice(2);
if (!secret) {
  console.error('usage: jwt.mjs <secret> <role>');
  process.exit(1);
}
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64({ alg: 'HS256', typ: 'JWT' });
const payload = b64({ iss: 'supabase-local', role, iat: now, exp: now + 10 * 365 * 24 * 3600 });
const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
process.stdout.write(`${header}.${payload}.${signature}`);
