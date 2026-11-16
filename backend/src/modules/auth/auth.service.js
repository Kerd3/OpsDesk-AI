import bcrypt from 'bcrypt';
import { query } from '../../database/pool.js';
import { recordAudit } from '../audit/audit.service.js';
import { toUserDto, BCRYPT_ROUNDS } from '../users/users.service.js';
import { AppError, badRequest } from '../../utils/errors.js';

// Compared against when the email is unknown so response timing does not
// reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('opsdesk-timing-equalizer', 10);

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

export async function verifyCredentials(email, password) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  const matches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

  if (!user || !matches || !user.is_active) {
    await recordAudit({
      actorId: user?.id ?? null,
      action: 'auth.login_failed',
      resourceType: 'session',
      metadata: { reason: !user ? 'unknown_email' : !matches ? 'wrong_password' : 'inactive_account' },
    });
    throw invalidCredentials();
  }

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  await recordAudit({ actorId: user.id, action: 'auth.login', resourceType: 'session', resourceId: user.id });
  return toUserDto({ ...user, last_login_at: new Date() });
}

export async function changePassword(userId, currentPassword, newPassword, currentSessionId) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    throw badRequest('Your current password is incorrect');
  }
  if (currentPassword === newPassword) throw badRequest('Choose a password that is different from your current one');
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, hash]);
  // Sign out every other session that belongs to this user.
  await query(`DELETE FROM "session" WHERE sess->>'userId' = $1 AND sid <> $2`, [userId, currentSessionId]);
  await recordAudit({ actorId: userId, action: 'auth.password_changed', resourceType: 'user', resourceId: userId });
}

export async function updateOwnProfile(userId, { fullName, department, jobTitle }) {
  const { rows } = await query(
    `UPDATE users SET full_name = COALESCE($2, full_name), department = COALESCE($3, department), job_title = COALESCE($4, job_title)
      WHERE id = $1
      RETURNING id, email, full_name, role, department, job_title, is_active, last_login_at, created_at`,
    [userId, fullName ?? null, department ?? null, jobTitle ?? null],
  );
  await recordAudit({ actorId: userId, action: 'user.profile_updated', resourceType: 'user', resourceId: userId });
  return toUserDto(rows[0]);
}
