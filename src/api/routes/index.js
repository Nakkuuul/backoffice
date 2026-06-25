import { Router } from 'express';
import healthRoutes from '../../modules/health/health.routes.js';
import authRoutes from '../../modules/auth/auth.routes.js';
import userRoutes from '../../modules/users/users.routes.js';

/**
 * Mounts every feature module under the API. Add new modules here.
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export default router;
