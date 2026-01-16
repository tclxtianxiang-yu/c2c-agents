export function formatMinUnit(amount: string, decimals = 6): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = (BigInt(amount) / divisor).toString();
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
