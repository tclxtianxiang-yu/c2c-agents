import { fromMinUnit } from '@c2c-agents/shared';

export function formatCurrency(amount: string, decimals = 6): string {
  const value = fromMinUnit(amount, decimals);
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
