const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const formatCurrency = (n: number) => currency.format(n);

export const formatPercent = (fraction: number, digits = 1) =>
  `${(fraction * 100).toFixed(digits)}%`;
