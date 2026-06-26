import { Router } from 'express';
import healthRoutes from '../../modules/health/health.routes.js';
import authRoutes from '../../modules/auth-service/auth.routes.js';
import { userRoutes } from '../../modules/user-service/user.routes.js';
import brokerInfoRoutes from '../../modules/broker-info-service/broker-info.routes.js';
import esignRoutes from '../../modules/esign-service/esign.routes.js';
import emailRoutes from '../../modules/email-service/email.routes.js';
import reportsRoutes from '../../modules/reports-service/reports.routes.js';
import documentRoutes from '../../modules/document-service/document.routes.js';
import accountingRoutes from '../../modules/accounting-service/accounting.routes.js';
import ekycRoutes from '../../modules/ekyc-service/ekyc.routes.js';

/**
 * Mounts every feature module under the API. Add new modules here.
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
// Broker's own entity profile (broker-info-service). Public API path kept as
// /company for frontend compatibility.
router.use('/company', brokerInfoRoutes);
router.use('/esign', esignRoutes);
router.use('/email', emailRoutes);
router.use('/reports', reportsRoutes);
router.use('/documents', documentRoutes);
router.use('/accounting', accountingRoutes);
router.use('/ekyc', ekycRoutes);

export default router;
