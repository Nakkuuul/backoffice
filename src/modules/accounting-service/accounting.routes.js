import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../api/middlewares/validate.js';
import { authenticate, requirePermission } from '../../api/middlewares/authenticate.js';
import * as controller from './accounting.controller.js';
import {
  createGroupSchema,
  updateGroupSchema,
  createLedgerSchema,
  updateLedgerSchema,
  listLedgersSchema,
  idParamSchema,
} from './accounting.validation.js';

/**
 * accounting-service routes (Tally-like). Masters now (Group + Ledger) plus
 * Balance Sheet / P&L. RBAC: accounting:read to view, accounting:manage to edit.
 */
const router = Router();
router.use(authenticate);

const read = requirePermission('accounting:read');
const manage = requirePermission('accounting:manage');

// Group Master
router.get('/groups', read, asyncHandler(controller.listGroups));
router.post('/groups', manage, validate(createGroupSchema), asyncHandler(controller.createGroup));
router.get('/groups/:id', read, validate(idParamSchema, 'params'), asyncHandler(controller.getGroup));
router.patch('/groups/:id', manage, validate(idParamSchema, 'params'), validate(updateGroupSchema), asyncHandler(controller.updateGroup));
router.delete('/groups/:id', manage, validate(idParamSchema, 'params'), asyncHandler(controller.deleteGroup));

// Ledger Master
router.get('/ledgers', read, validate(listLedgersSchema, 'query'), asyncHandler(controller.listLedgers));
router.post('/ledgers', manage, validate(createLedgerSchema), asyncHandler(controller.createLedger));
router.get('/ledgers/:id', read, validate(idParamSchema, 'params'), asyncHandler(controller.getLedger));
router.patch('/ledgers/:id', manage, validate(idParamSchema, 'params'), validate(updateLedgerSchema), asyncHandler(controller.updateLedger));
router.delete('/ledgers/:id', manage, validate(idParamSchema, 'params'), asyncHandler(controller.deleteLedger));

// Financial statements
router.get('/reports/balance-sheet', read, asyncHandler(controller.balanceSheet));
router.get('/reports/profit-loss', read, asyncHandler(controller.profitAndLoss));

export default router;
