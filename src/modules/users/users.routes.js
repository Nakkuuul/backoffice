import { Router } from 'express';

/**
 * User management routes.
 *
 * Layered pattern for this module:
 *   users.routes.js      → HTTP routes + middleware wiring
 *   users.controller.js  → request/response handling
 *   users.service.js     → business logic
 *   users.repository.js  → DB access (uses src/db/pool.js)
 *   users.validation.js  → Joi schemas
 *
 * TODO: implement endpoints.
 */
const router = Router();

// router.get('/', authenticate, asyncHandler(listUsers));

export default router;
