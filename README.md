# Monte Carlo Retirement Simulator

A single-page app (Vite + Svelte 5 + TypeScript) that finds the largest first-year withdrawal, in
dollars, that a retirement portfolio can support.

You enter the initial wealth, mean annual return, volatility, inflation rate, target success rate,
retirement years and number of simulation runs. Every invocation then searches for the maximum
first-year withdrawal under two approaches and shows them side by side:

- **Standard**: the first-year withdrawal is raised with inflation every year. The search targets
  the success rate you enter.
- **Guardrails** (Guyton and Klinger, 2006): each year after the first, the withdrawal is raised
  with inflation, except after a losing year when the current rate (withdrawal ÷ portfolio) is above
  the initial rate. If the current rate is then more than 20% above the initial rate, the withdrawal
  is cut 10% (not in the final 15 years); if it is more than 20% below, it is raised 10%. The search
  always targets a 99% success rate, the paper's confidence standard.

A run succeeds if it funds every withdrawal, taken at the start of each year. Annual returns follow
a normal distribution, clamped at −100%; the mean is arithmetic and volatility is the standard
deviation.

All returns are drawn once per invocation, so both strategies and every trial withdrawal face the
same simulated markets. Each search bisects between $0 and the whole portfolio and keeps the largest
withdrawal that meets its target, to within about $1 per $1 million of wealth.

For each approach the results show the maximum first-year withdrawal and its share of initial
wealth, the target and simulated success rates, and the mean, median, 25th and 10th percentiles,
minimum and maximum of the average annual withdrawal and of ending wealth. For the guardrails they
also show the final-year and lowest-year withdrawals, the final withdrawal rate, and how often cuts,
raises and skipped inflation raises happened. The search runs in a Web Worker so large runs don't
freeze the page.

```sh
npm install
npm run dev      # start dev server
npm test         # unit tests (Vitest)
npm run check    # type-check (svelte-check)
npm run build    # static build in dist/
```

The simulation core lives in `src/lib/sim/` and has no UI dependencies.
