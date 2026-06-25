# accounting-service

Double-entry accounting for the broker's books, modelled like **Tally Prime**.
Current scope is the **masters** (Group + Ledger) plus **Balance Sheet** and
**Profit & Loss**. Vouchers/transactions come next once the UI is ready.

## Concepts (Tally model)

- **Group** — a node in the hierarchical chart of accounts. Each group has a
  *nature* (`asset` | `liability` | `income` | `expense`) which decides whether
  its ledgers land on the Balance Sheet or the P&L. Sub-groups inherit their
  parent's nature.
- **Ledger** — a postable account under exactly one group (e.g. "HDFC Bank"
  under *Bank Accounts*, a client under *Sundry Debtors*, "Brokerage" under
  *Sales Accounts*). Holds an opening balance (Dr/Cr).

The **28 predefined Tally groups** (15 primary + 13 sub-groups) are seeded by
migration `009` and marked `is_system` (protected from edit/delete).

## Status

| Feature | Status |
| ------- | ------ |
| Group Master (CRUD, hierarchy, nature inheritance) | ✅ |
| Ledger Master (CRUD, opening balance Dr/Cr, client link) | ✅ |
| Balance Sheet | ✅ (from opening balances; transactional once vouchers exist) |
| Profit & Loss | ✅ |
| Vouchers / transactions / day book | planned |

> Statements currently compute from ledger **opening balances** (no vouchers
> yet). The math is centralized so closing balance = opening + Σ(postings) drops
> in unchanged when transactions arrive (`basis` field flips to `transactional`).

## API (`/api/v1/accounting`, RBAC: `accounting:read` / `accounting:manage`)

| Method | Path | Perm | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/groups` | read | List groups (with ledger counts) |
| POST | `/groups` | manage | Create a group (under a parent → inherits nature) |
| GET/PATCH/DELETE | `/groups/:id` | read/manage | Get / update / delete (system groups protected) |
| GET | `/ledgers` | read | List ledgers (filter by group / client) |
| POST | `/ledgers` | manage | Create a ledger under a group |
| GET/PATCH/DELETE | `/ledgers/:id` | read/manage | Get / update / delete |
| GET | `/reports/balance-sheet` | read | Balance Sheet (assets vs liabilities + net profit) |
| GET | `/reports/profit-loss` | read | P&L (income vs expense, net profit/loss) |

```jsonc
// POST /accounting/ledgers
{ "name": "HDFC Bank - 1234", "groupId": 22, "openingBalance": 500000, "openingBalanceType": "Dr" }

// POST /accounting/groups  (sub-group; nature inherited from parent)
{ "name": "Brokerage Receivable", "parentId": 28 }
```

## RBAC
New permissions `accounting:read` / `accounting:manage`, plus a broker role
**`accountant`** (`accounting:*`, plus reports/documents/clients read). `admin`
gets `accounting:*`; `compliance`/`auditor` get `accounting:read`.

## Diagnostics
```bash
npm run accounting:test    # create ledgers, compute Balance Sheet + P&L
```

## TODO / roadmap
- [ ] Vouchers (journal/receipt/payment/contra/sales/purchase) — double-entry postings.
- [ ] Ledger closing balances, day book, trial balance.
- [ ] Cost centres, bill-wise details, GST.
- [ ] Period selection (financial year) for statements.
- [ ] Export statements via reports-service (PDF/XLSX) and esign/email delivery.
- [ ] Auto-create a client ledger (under Sundry Debtors) when a client is onboarded.
