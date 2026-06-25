import { Router } from 'express';
import healthRoutes from '../../modules/health/health.routes.js';
import authRoutes from '../../modules/auth/auth.routes.js';
import userRoutes from '../../modules/users/users.routes.js';
import esignRoutes from '../../modules/esign-service/esign.routes.js';
import emailRoutes from '../../modules/email-service/email.routes.js';

/**
 * Mounts every feature module under the API. Add new modules here.
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/esign', esignRoutes);
router.use('/email', emailRoutes);

export default router;
