# Experimental Classless Component Optimization

Run date: 2026-08-20

## Compared Builds

- Option off: Uniwind `0f8bdcd` (`main`), with the existing resolver-backed wrappers.
- Option on: Uniwind `72ccce4`, with
  `experimental.optimizeClasslessComponents: true`.
- Raw baseline: the unchanged React Native StyleSheet app from the same emulator session.

Both Uniwind APKs were built from the same source revision apart from the experimental
compile-time dispatch change. Metro bundles were forcibly regenerated after switching packages
and checked for the presence or absence of the private raw-component module.

## Environment

- React Native: `0.82.0`
- Uniwind: `1.11.0`
- Android release build, Hermes, Fabric/new architecture, arm64
- Android 15 / API 35 emulator, arm64, 2 vCPUs, 2.5 GB guest RAM
- 2 warm-up mounts and 7 measured mounts per item count
- Fresh app process for each variant

## Results

Median mount-to-commit time:

| Items | Raw StyleSheet | T2 option off | T2 option on | T2 change | T3 option off | T3 option on | T3 change |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 7.19 ms | 13.30 ms | 8.78 ms | -34.0% | 12.21 ms | 11.14 ms | -8.7% |
| 250 | 14.73 ms | 32.25 ms | 21.47 ms | -33.4% | 31.32 ms | 28.09 ms | -10.3% |
| 500 | 37.14 ms | 58.63 ms | 38.86 ms | -33.7% | 58.23 ms | 50.99 ms | -12.4% |
| 1000 | 62.93 ms | 85.05 ms | 69.09 ms | -18.8% | 97.08 ms | 101.27 ms | +4.3% |
| 2000 | 164.84 ms | 207.59 ms | 158.75 ms | -23.5% | 223.31 ms | 221.86 ms | -0.6% |

T2 uses the same classless StyleSheet tree in both builds. The option removes most of the
wrapper-only cost and brings the 1000- and 2000-item results back into the raw React Native range.

T3 keeps its className nodes on the existing wrapper path. Its large-tree results are effectively
unchanged. The smaller T3 improvements include fixed classless benchmark chrome that the transform
can optimize and normal emulator run variance.

Raw logs are stored beside this report. `summary.csv` contains the medians and calculated changes.

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
