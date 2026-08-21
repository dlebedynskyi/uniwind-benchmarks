# PR 640 App Matrix Report

Run date: 2026-08-21

Related:

- [Summary](./SUMMARY.md)
- [Uniwind discussion #639](https://github.com/uni-stack/uniwind/discussions/639)
- [Uniwind PR #640](https://github.com/uni-stack/uniwind/pull/640)
- PR 640 revision: `24fd45663090281e43bb8637debe231219e640e1`

## Executive summary

We suspected that wrapping React Native components with Uniwind adds measurable render overhead in
large classless trees, even when no class props are present. This simulator test verifies that
suspicion for the 1,000-item benchmark on both Community and Pro.

Without PR 640, the classless wrapper variants were 19.49 to 27.24 ms slower than the StyleSheet
baseline by median, depending on runtime and platform. Enabling PR 640 removed that gap:

- Android Community: paired improvement of 19.45 ms, 95% CI -21.82 to -17.09 ms
- Android Pro: paired improvement of 25.13 ms, 95% CI -26.53 to -23.73 ms
- iOS Community: paired improvement of 28.14 ms, 95% CI -28.78 to -27.49 ms
- iOS Pro: paired improvement of 25.02 ms, 95% CI -25.74 to -24.31 ms

The fully class-based Community and Pro comparisons were effectively unchanged; all four paired
confidence intervals include zero.

## Question

Does the Uniwind component wrapper impose a render cost on a large tree that uses only React Native
`StyleSheet`, and does PR 640's compile-time classless optimization remove that cost without
regressing fully styled Uniwind trees?

This test evaluates one tree size. It can verify overhead at 1,000 items, but it cannot establish
whether the cost grows linearly, superlinearly, or exponentially as the tree grows.

## Variants

| Variant | UI | Uniwind runtime | PR 640 optimization |
| --- | --- | --- | --- |
| `stylesheet` | StyleSheet | None | No |
| `mixed` | Same StyleSheet UI | Community | No |
| `mixed-pr640` | Same StyleSheet UI | Community | Yes |
| `uniwind` | Uniwind classes | Community | No |
| `uniwind-pr640` | Uniwind classes | Community | Yes |
| `mixed-pro` | Same StyleSheet UI | Pro | No |
| `mixed-pro-pr640` | Same StyleSheet UI | Pro | Yes |
| `uniwind-pro` | Uniwind classes | Pro | No |
| `uniwind-pro-pr640` | Uniwind classes | Pro | Yes |

`apps/stylesheet` remains the untouched control app. Community classless testing uses the restored
standalone `apps/mixed` app. Pro classless testing uses a benchmark-only entry and an exact copy of
the StyleSheet UI under `harness/app-matrix`, leaving the baseline app clean.

The optimized Community builds use PR 640's Metro wrapper and JavaScript runtime. The optimized Pro
builds retain Uniwind Pro `1.0.0-beta.11` and add only PR 640's Metro transform and raw-component
module. Off/on iOS Pro artifacts have identical native executable hashes and different JavaScript
bundle hashes.

## Method

- React Native `0.82.0`, React `19.1.1`, Release, Hermes, Fabric/new architecture, arm64
- Community runtime: Uniwind `1.11.0`
- Pro runtime: Uniwind Pro `1.0.0-beta.11`
- 1,000 repeated items and 2,003 reported public nodes
- 10 measured render cycles per fresh app process
- 18 balanced, interleaved rounds per variant
- 162 fresh uninstall/install/launch samples per platform
- 324 total process samples across Android and iOS
- Descriptive result: median of the 18 per-process medians
- Paired result: mean of same-round off/on median differences
- 95% confidence interval: paired Student's t interval across 18 rounds

The round order rotates across all nine variants and reverses during the second nine-round block.
This distributes temporal and host-load drift across the matrix.

The in-app harness measures from the state update that changes the rendered tree until
`requestIdleCallback`, then reports the median of 10 cycles. It is an application-level
render-to-idle measurement, not a direct React commit-duration profiler.

## Simulators

### Android

- Android 15 / API 35
- AVD: `uniwind_low_end_api35`
- arm64-v8a, 2 vCPUs, 2.5 GB guest RAM
- 1080 x 2220 at 440 dpi
- SwiftShader, headless, snapshots disabled
- Window, transition, and animator scales disabled

### iOS

- iPhone SE (3rd generation) simulator
- iOS 18.6, arm64
- Simulator UDID: `2002481A-F8F0-4490-9C45-EC633D88810E`
- Xcode 26.3

Android was shut down before iOS was booted so the simulators did not compete for host resources.

## Android results

| Variant | Median (ms) | Mean (ms) | Delta vs StyleSheet median |
| --- | ---: | ---: | ---: |
| `stylesheet` | 66.29 | 65.69 | - |
| `mixed` | 85.78 | 86.83 | +19.49 |
| `mixed-pr640` | 65.46 | 67.37 | -0.84 |
| `uniwind` | 94.21 | 94.77 | +27.92 |
| `uniwind-pr640` | 94.01 | 94.49 | +27.72 |
| `mixed-pro` | 91.44 | 92.18 | +25.14 |
| `mixed-pro-pr640` | 65.82 | 67.05 | -0.47 |
| `uniwind-pro` | 74.80 | 75.62 | +8.51 |
| `uniwind-pro-pr640` | 75.37 | 75.53 | +9.08 |

| Paired comparison | Mean delta | Median delta | 95% CI |
| --- | ---: | ---: | ---: |
| `mixed-pr640` vs `mixed` | -19.45 ms | -20.34 ms | -21.82 to -17.09 ms |
| `uniwind-pr640` vs `uniwind` | -0.28 ms | -0.07 ms | -1.56 to +1.00 ms |
| `mixed-pro-pr640` vs `mixed-pro` | -25.13 ms | -25.55 ms | -26.53 to -23.73 ms |
| `uniwind-pro-pr640` vs `uniwind-pro` | -0.08 ms | +0.46 ms | -2.07 to +1.90 ms |

## iOS results

| Variant | Median (ms) | Mean (ms) | Delta vs StyleSheet median |
| --- | ---: | ---: | ---: |
| `stylesheet` | 53.71 | 53.83 | - |
| `mixed` | 80.94 | 81.39 | +27.24 |
| `mixed-pr640` | 52.92 | 53.25 | -0.79 |
| `uniwind` | 88.34 | 88.42 | +34.63 |
| `uniwind-pr640` | 88.53 | 88.53 | +34.82 |
| `mixed-pro` | 79.32 | 79.31 | +25.61 |
| `mixed-pro-pr640` | 53.89 | 54.29 | +0.19 |
| `uniwind-pro` | 59.54 | 59.59 | +5.84 |
| `uniwind-pro-pr640` | 59.28 | 59.85 | +5.58 |

| Paired comparison | Mean delta | Median delta | 95% CI |
| --- | ---: | ---: | ---: |
| `mixed-pr640` vs `mixed` | -28.14 ms | -27.95 ms | -28.78 to -27.49 ms |
| `uniwind-pr640` vs `uniwind` | +0.10 ms | -0.18 ms | -0.88 to +1.08 ms |
| `mixed-pro-pr640` vs `mixed-pro` | -25.02 ms | -24.80 ms | -25.74 to -24.31 ms |
| `uniwind-pro-pr640` vs `uniwind-pro` | +0.26 ms | +0.01 ms | -0.64 to +1.15 ms |

## Findings

### The classless wrapper cost is reproducible

The same StyleSheet tree is materially slower when its React Native components resolve through
Uniwind wrappers. This occurs with both Community and Pro, on both simulators. The result verifies
the original suspicion for this benchmark rather than relying on earlier measurements.

### PR 640 removes the measured classless cost

With the optimization enabled, both Community and Pro classless medians return to within 0.84 ms of
the StyleSheet control on Android and within 0.79 ms on iOS. Values slightly below the control are
normal measurement variation and should not be interpreted as PR 640 outperforming raw React
Native.

### Fully styled trees are not materially changed

The Community and Pro class-based off/on deltas are close to zero on both platforms, and their 95%
confidence intervals include zero. This is expected because components with Uniwind class props
still need the Uniwind-aware implementation.

### The likely mechanism is per-component React work

The observed behavior is consistent with wrapper fibers and associated hook work being repeated
across a large classless tree. PR 640 selects raw React Native components before React element
creation when the transform can prove that no Uniwind class props are present, avoiding that work.

The benchmark does not separately measure fiber allocation, hook traversal, reconciliation, or
native layout, so it does not assign an exact share of the delta to each internal mechanism.

## Limitations

- These are simulator results. They isolate relative JavaScript and React overhead but do not
  reproduce absolute latency on a physical low-end device.
- Only one tree size was tested. The data verifies a substantial cost at 1,000 items but cannot
  prove an exponential growth curve.
- The harness uses `requestIdleCallback`; it measures application render-to-idle time rather than
  React profiler commit time.
- Community and Pro are compared against their own off/on builds. Differences between Community
  and Pro runtimes are descriptive, not a controlled implementation comparison.
- The UI is intentionally synthetic and dense. Production behavior depends on component mix,
  virtualization, memoization, state updates, and the fraction of classless elements.

## Reproduction

Build PR 640 in a sibling `uniwind` checkout at the revision above, then run:

```sh
bun install
bun benchmark:verify-pr640

bun benchmark:build --platform android
bun benchmark:run --platform android --device <adb-serial> --rounds 18

bun benchmark:build --platform ios --device <simulator-udid>
bun benchmark:run --platform ios --device <simulator-udid> --rounds 18
```

Each platform directory contains:

- `summary.csv`: per-variant descriptive statistics
- `comparisons.csv`: paired off/on deltas and confidence intervals
- `summary.json`: summary, comparisons, and parsed records
- `rounds/`: all 162 raw process logs
