import { Router } from 'express';
import healthRoutes from '../../modules/health/health.routes.js';
import esignRoutes from '../../modules/esign-service/esign.routes.js';
import emailRoutes from '../../modules/email-service/email.routes.js';
import reportsRoutes from '../../modules/reports-service/reports.routes.js';
import documentRoutes from '../../modules/document-service/document.routes.js';

/**
 * Mounts every feature module under the API. Add new modules here.
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/esign', esignRoutes);
router.use('/email', emailRoutes);
router.use('/reports', reportsRoutes);
router.use('/documents', documentRoutes);

export default router;
