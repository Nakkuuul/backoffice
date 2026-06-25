import { BadRequestError, NotFoundError, ConflictError } from '../../shared/errors/AppError.js';
import * as repo from './accounting.repository.js';
import { NATURES } from './accounting.constants.js';

/* ── Groups ───────────────────────────────────────────────────────────────── */

/**
 * Create a group. Like Tally, a group is created "under" a parent group and
 * inherits the parent's nature. A top-level (primary) group has no parent and
 * must specify its nature.
 */
export async function createGroup(input) {
  if (await repo.findGroupByName(input.name)) {
    throw new ConflictError(`A group named "${input.name}" already exists`);
  }

  let nature;
  let parentId = null;
  if (input.parentId) {
    const parent = await repo.findGroupById(input.parentId);
    if (!parent) throw new BadRequestError(`Parent group ${input.parentId} not found`);
    nature = parent.nature; // inherit
    parentId = parent.id;
  } else {
    if (!NATURES.includes(input.nature)) {
      throw new BadRequestError('A primary group (no parent) requires a valid nature');
    }
    nature = input.nature;
  }

  return repo.createGroup({ name: input.name, parentId, nature, isPrimary: !parentId });
}

export async function listGroups() {
  return repo.listGroups();
}

export async function getGroup(id) {
  const g = await repo.findGroupById(id);
  if (!g) throw new NotFoundError(`Group ${id} not found`);
  return g;
}

export async function updateGroup(id, fields) {
  const g = await repo.findGroupById(id);
  if (!g) throw new NotFoundError(`Group ${id} not found`);
  if (g.is_system) throw new BadRequestError('Predefined system groups cannot be modified');

  // If re-parenting, nature follows the new parent.
  const patch = { ...fields };
  if (fields.parentId) {
    const parent = await repo.findGroupById(fields.parentId);
    if (!parent) throw new BadRequestError(`Parent group ${fields.parentId} not found`);
    if (parent.id === g.id) throw new BadRequestError('A group cannot be its own parent');
    patch.nature = parent.nature;
  }
  if (fields.name && fields.name !== g.name && (await repo.findGroupByName(fields.name))) {
    throw new ConflictError(`A group named "${fields.name}" already exists`);
  }
  return repo.updateGroup(id, patch);
}

export async function deleteGroup(id) {
  const g = await repo.findGroupById(id);
  if (!g) throw new NotFoundError(`Group ${id} not found`);
  if (g.is_system) throw new BadRequestError('Predefined system groups cannot be deleted');
  const { groups, ledgers } = await repo.groupChildCount(id);
  if (groups > 0 || ledgers > 0) {
    throw new ConflictError(`Group has ${groups} sub-group(s) and ${ledgers} ledger(s); empty it first`);
  }
  await repo.deleteGroup(id);
}

/* ── Ledgers ──────────────────────────────────────────────────────────────── */

export async function createLedger(input) {
  if (await repo.findLedgerByName(input.name)) {
    throw new ConflictError(`A ledger named "${input.name}" already exists`);
  }
  const group = await repo.findGroupById(input.groupId);
  if (!group) throw new BadRequestError(`Group ${input.groupId} not found`);
  return repo.createLedger(input);
}

export async function listLedgers(params) {
  return repo.listLedgers(params);
}

export async function getLedger(id) {
  const l = await repo.findLedgerById(id);
  if (!l) throw new NotFoundError(`Ledger ${id} not found`);
  return l;
}

export async function updateLedger(id, fields) {
  const l = await repo.findLedgerById(id);
  if (!l) throw new NotFoundError(`Ledger ${id} not found`);
  if (l.is_system) throw new BadRequestError('System ledgers cannot be modified');
  if (fields.groupId && !(await repo.findGroupById(fields.groupId))) {
    throw new BadRequestError(`Group ${fields.groupId} not found`);
  }
  if (fields.name && fields.name !== l.name && (await repo.findLedgerByName(fields.name))) {
    throw new ConflictError(`A ledger named "${fields.name}" already exists`);
  }
  return repo.updateLedger(id, fields);
}

export async function deleteLedger(id) {
  const l = await repo.findLedgerById(id);
  if (!l) throw new NotFoundError(`Ledger ${id} not found`);
  if (l.is_system) throw new BadRequestError('System ledgers cannot be deleted');
  // (Once vouchers exist, also block deletion when transactions reference it.)
  await repo.deleteLedger(id);
}
