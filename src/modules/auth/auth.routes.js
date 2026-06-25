import { Router } from 'express';

/**
 * Authentication routes (login, refresh, logout).
 *
 * Layered pattern for this module:
 *   auth.routes.js      → HTTP routes + middleware wiring
 *   auth.controller.js  → request/response handling
 *   auth.service.js     → business logic (token issuing, password checks)
 *   auth.repository.js  → DB access for auth/credentials
 *   auth.validation.js  → Joi schemas for request bodies
 *
 * TODO: implement endpoints.
 */
const router = Router();

// router.post('/login', validate(loginSchema), asyncHandler(login));

export default router;
