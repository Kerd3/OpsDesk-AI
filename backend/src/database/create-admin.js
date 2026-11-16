// Creates the first administrator account. Safe to run in production.
//
//   ADMIN_EMAIL=you@company.com ADMIN_NAME="Your Name" ADMIN_PASSWORD=... node src/database/create-admin.js
//
// The password is read from the environment (not a command-line argument) so it
// does not end up in shell history or process listings.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './pool.js';
import { createUser } from '../modules/users/users.service.js';

export function validateAdminInput({ email, fullName, password }) {
  const problems = [];
  // Trim first: values pasted into hosting dashboards often carry stray whitespace.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email ?? '').trim())) problems.push('ADMIN_EMAIL must be a valid email address');
  if (!fullName || fullName.trim().length < 2) problems.push('ADMIN_NAME must be at least 2 characters');
  if (!password || password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    problems.push('ADMIN_PASSWORD must be at least 12 characters and contain a letter and a number');
  }
  return problems;
}

export async function createAdmin({ email, fullName, password }) {
  const problems = validateAdminInput({ email, fullName, password });
  if (problems.length) throw new Error(problems.join('\n'));
  const normalized = email.trim().toLowerCase();
  const existing = await query('SELECT role FROM users WHERE email = $1', [normalized]);
  if (existing.rowCount) throw new Error(`A user with the email ${normalized} already exists (role: ${existing.rows[0].role})`);
  return createUser({ email: normalized, fullName: fullName.trim(), role: 'admin', password }, null);
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  try {
    const user = await createAdmin({ email: process.env.ADMIN_EMAIL, fullName: process.env.ADMIN_NAME, password: process.env.ADMIN_PASSWORD });
    console.log(`[create-admin] administrator created: ${user.email}`);
  } catch (err) {
    console.error(`[create-admin] ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
