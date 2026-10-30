# Monte Carlo Retirement Simulator

A single-page app (Vite + Svelte 5 + TypeScript) that estimates how likely a retirement portfolio is to last.

Each run draws annual returns and withdraws an inflation-adjusted amount at the start of each year
(first-year withdrawal = rate × initial wealth). The headline output is the success rate: the share of
runs that fund every withdrawal. The app also reports the mean, median, 25th and 10th percentiles,
minimum and maximum of ending wealth, in nominal and today's dollars. The simulation runs in a Web
Worker so large runs don't freeze the page.

Every simulation runs twice with the same inputs and seed, and the results are shown side by side:

- **Normal:** annual returns follow a normal distribution, clamped at −100%.
- **Lognormal:** 1 + annual return follows a lognormal distribution.

The mean return is the arithmetic mean and volatility is the standard deviation of annual returns in
both models, so they differ only in distribution shape. The lognormal geometric mean is derived from
those two inputs (7% arithmetic at 15% volatility is about 5.96% geometric).

```sh
npm install
npm run dev      # start dev server
npm test         # unit tests (Vitest)
npm run check    # type-check (svelte-check)
npm run build    # static build in dist/
```

The simulation core lives in `src/lib/sim/` and has no UI dependencies.
