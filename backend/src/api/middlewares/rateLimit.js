import { TooManyRequestsError } from '../../shared/errors/AppError.js';

/**
 * Minimal in-memory fixed-window rate limiter for abuse-sensitive endpoints
 * (login, 2FA verify/enable/setup, password change). Keyed per (endpoint, ip,
 * identifier) so one attacker/account can't exhaust attempts for everyone.
 *
 * NOTE: in-memory = per-process. Fine for an on-prem single/few-node deployment;
 * for a horizontally-scaled fleet, back this with Redis (TODO).
 */
const buckets = new Map(); // key -> { count, resetAt }

// Periodically drop expired buckets so the map doesn't grow unbounded.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}, 10 * 60 * 1000);
sweep.unref?.();

const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

/**
 * @param {object} opts
 * @param {number} opts.windowMs  window length in ms
 * @param {number} opts.max       max attempts per window
 * @param {string} opts.name      bucket namespace (per endpoint)
 * @param {(req)=>string} [opts.identifier]  extra key part (e.g. email / user id)
 */
export function rateLimit({ windowMs, max, name, identifier }) {
  return (req, _res, next) => {
    const id = identifier ? identifier(req) : '';
    const key = `${name}:${clientIp(req)}:${id}`;
    const now = Date.now();

    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;

    if (b.count > max) {
      const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
      return next(
        new TooManyRequestsError(`Too many attempts. Try again in ${retryAfter}s.`, {
          details: { retryAfter },
        }),
      );
    }
    next();
  };
}

// Common limiters. Login/2FA are strict (anti-brute-force); keyed by ip+identity.
export const loginLimiter = rateLimit({
  name: 'login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  identifier: (req) => String(req.body?.email || '').toLowerCase(),
});

// Applied AFTER authenticate, so req.user is available (interim token user id).
export const twoFactorLimiter = rateLimit({
  name: '2fa',
  windowMs: 15 * 60 * 1000,
  max: 8,
  identifier: (req) => String(req.user?.id || ''),
});

export const passwordChangeLimiter = rateLimit({
  name: 'pwd',
  windowMs: 15 * 60 * 1000,
  max: 10,
  identifier: (req) => String(req.user?.id || ''),
});
