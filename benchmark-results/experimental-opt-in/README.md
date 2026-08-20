# Experimental Classless Component Optimization

Run date: 2026-08-20

## Compared Builds

- Option off: Uniwind `0f8bdcd` (`main`), with the existing resolver-backed wrappers.
- Option on: Uniwind `72ccce4`, with
  `experimental.optimizeClasslessComponents: true`.
- Raw baseline: the unchanged React Native StyleSheet app from each simulator session.

The Uniwind builds use the same source revision apart from the experimental compile-time dispatch
change. Metro bundles were forcibly regenerated and verified for the presence or absence of the
private raw-component module. The iOS option-off/on native executables are byte-identical.

## Method

- React Native: `0.82.0`
- Uniwind: `1.11.0`
- Release builds, Hermes, Fabric/new architecture, arm64
- 12 balanced, interleaved rounds per variant
- Fresh install and process for each round
- 2 warm-up mounts and 7 measured mounts per item count and round
- 84 measured mounts per item count and variant

Times are the median of the 12 independent round medians. Deltas and 95% confidence intervals
are paired across the 12 balanced rounds.

Simulator results isolate relative wrapper overhead but do not represent absolute low-end-device
latency.

## Android Results

Android 15 / API 35 emulator, arm64, 2 vCPUs, 2.5 GB guest RAM.

| Items | Raw StyleSheet | Option off | Option on | On vs off | Paired 95% CI |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 10.80 ms | 11.85 ms | 10.45 ms | -5.1% | -3.24 to +2.07 ms |
| 250 | 18.85 ms | 26.48 ms | 23.69 ms | -17.3% | -7.67 to -2.57 ms |
| 500 | 38.92 ms | 44.14 ms | 37.44 ms | -16.6% | -16.83 to -1.45 ms |
| 1000 | 62.77 ms | 86.56 ms | 64.32 ms | -25.8% | -26.88 to -18.36 ms |
| 2000 | 164.51 ms | 203.16 ms | 163.37 ms | -18.4% | -44.12 to -31.42 ms |

The option is consistently faster than the existing wrapper path from 250 items onward. At 1000
and 2000 items, it reduces mean paired mount time by 22.62 ms and 37.77 ms respectively.

Option-on and raw React Native are statistically indistinguishable at every measured size: all
paired 95% confidence intervals include zero. The 2000-item raw result was especially variable,
with round medians from 153.20 ms to 241.77 ms, so the result supports restoring the raw React
Native performance range rather than claiming the optimized path is faster.

## iOS Results

iOS 18.6 iPhone SE (3rd generation) simulator, arm64, Xcode 26.3.

| Items | Raw StyleSheet | Option off | Option on | On vs off | Paired 95% CI |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 15.59 ms | 20.80 ms | 16.72 ms | -23.9% | -7.75 to -2.19 ms |
| 250 | 30.18 ms | 40.75 ms | 30.86 ms | -20.9% | -10.81 to -6.09 ms |
| 500 | 47.83 ms | 63.12 ms | 49.36 ms | -21.5% | -14.69 to -11.42 ms |
| 1000 | 79.27 ms | 103.28 ms | 79.08 ms | -21.6% | -25.90 to -17.82 ms |
| 2000 | 176.83 ms | 220.74 ms | 176.45 ms | -19.9% | -47.11 to -40.63 ms |

The option is faster than the existing wrapper path at every measured size. At 1000 and 2000
items, it reduces mean paired mount time by 21.86 ms and 43.87 ms respectively.

Option-on and raw React Native are statistically indistinguishable at every measured size: all
paired 95% confidence intervals include zero.

## Data

Each platform directory contains:

- `summary.csv`: aggregate medians, ranges, paired deltas, and confidence intervals
- `round-medians.csv`: every round median
- `summary.json`: full aggregate data
- `rounds/`: all 36 measured run logs

The five top-level logs are the superseded initial single-round experiment and remain for
traceability.

## Opt-In

```js
module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  experimental: {
    optimizeClasslessComponents: true,
  },
})
```

The option is off by default. Prop spreads, `className`, and any `*ClassName` prop conservatively
retain the existing Uniwind wrapper.
