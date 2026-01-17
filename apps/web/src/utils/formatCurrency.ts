import { fromMinUnit } from '@c2c-agents/shared';

export function formatCurrency(amount: string, decimals = 6): string {
  const value = fromMinUnit(amount, decimals);
  const [wholePart, fractionPart = ''] = value.split('.');
  const trimmedFraction = fractionPart.replace(/0+$/, '');
  const formattedWhole = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (!trimmedFraction) {
    return formattedWhole;
  }
  return `${formattedWhole}.${trimmedFraction}`;
}
