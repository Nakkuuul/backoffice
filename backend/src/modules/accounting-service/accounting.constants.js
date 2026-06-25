/** Accounting nature — drives Balance Sheet (asset/liability) vs P&L (income/expense). */
export const NATURE = Object.freeze({
  ASSET: 'asset',
  LIABILITY: 'liability',
  INCOME: 'income',
  EXPENSE: 'expense',
});

export const NATURES = Object.values(NATURE);

/** Opening balance side. */
export const BALANCE_TYPE = Object.freeze({ DR: 'Dr', CR: 'Cr' });
