# PR 640 App Matrix

Run date: 2026-08-21

Related:

- [Uniwind discussion #639](https://github.com/uni-stack/uniwind/discussions/639)
- [Uniwind PR #640](https://github.com/uni-stack/uniwind/pull/640)
- PR 640 revision: `24fd45663090281e43bb8637debe231219e640e1`

## Question

We suspected that Uniwind's Metro wrapper slows large classless React Native trees because every
eligible component receives the Uniwind wrapper fiber and hooks even when no class props are used.

This matrix tests that suspicion against the original benchmark UI and checks whether PR 640's
experimental compile-time classless-component optimization removes the overhead.

## Variants

| Variant | UI | Metro wrapper | PR 640 optimization |
| --- | --- | --- | --- |
| `stylesheet` | StyleSheet | No | No |
| `mixed` | Same StyleSheet UI | Yes | No |
| `mixed-pr640` | Same StyleSheet UI | Yes | Yes |
| `uniwind` | Uniwind classes | Yes | No |
| `uniwind-pr640` | Uniwind classes | Yes | Yes |
| `uniwind-pro` | Uniwind Pro classes | Yes | No |
| `uniwind-pro-pr640` | Uniwind Pro classes | Yes | Yes |

The optimized Community build uses PR 640's Metro wrapper and JavaScript runtime. The optimized Pro
build retains the Pro runtime and injects only PR 640's Metro transform and raw-component module.

## Method

- React Native `0.82.0`, Release, Hermes, Fabric/new architecture, arm64
- Original benchmark layout with 1,000 items and 2,003 reported public nodes
- 10 measured render cycles per fresh app process
- 14 balanced, interleaved rounds per variant
- Fresh uninstall, install, and launch for every round
- Result per variant: median of the 14 round medians
- Deltas and 95% confidence intervals: paired across the 14 rounds

Simulator results isolate relative JavaScript and React overhead. They do not reproduce the
absolute latency of a physical low-end device.

## Android

Android 15 / API 35 AVD `uniwind_low_end_api35`, arm64-v8a, 2 vCPUs, 2.5 GB guest RAM,
1080 x 2220 at 440 dpi, SwiftShader, headless.

| Variant | Median (ms) |
| --- | ---: |
| `stylesheet` | 66.04 |
| `mixed` | 88.36 |
| `mixed-pr640` | 70.00 |
| `uniwind` | 95.55 |
| `uniwind-pr640` | 96.54 |
| `uniwind-pro` | 76.20 |
| `uniwind-pro-pr640` | 76.86 |

| Paired comparison | Mean delta | 95% CI |
| --- | ---: | ---: |
| `mixed-pr640` vs `mixed` | -17.80 ms | -21.16 to -14.44 ms |
| `uniwind-pr640` vs `uniwind` | +1.29 ms | -8.82 to +11.40 ms |
| `uniwind-pro-pr640` vs `uniwind-pro` | -0.45 ms | -7.04 to +6.14 ms |

## iOS

iPhone SE (3rd generation) simulator, iOS 18.6, arm64, Xcode 26.3.

| Variant | Median (ms) |
| --- | ---: |
| `stylesheet` | 54.51 |
| `mixed` | 82.16 |
| `mixed-pr640` | 54.62 |
| `uniwind` | 88.79 |
| `uniwind-pr640` | 88.67 |
| `uniwind-pro` | 62.57 |
| `uniwind-pro-pr640` | 61.87 |

| Paired comparison | Mean delta | 95% CI |
| --- | ---: | ---: |
| `mixed-pr640` vs `mixed` | -26.88 ms | -27.96 to -25.79 ms |
| `uniwind-pr640` vs `uniwind` | -0.61 ms | -2.12 to +0.89 ms |
| `uniwind-pro-pr640` vs `uniwind-pro` | -0.51 ms | -1.83 to +0.82 ms |

## Conclusion

The simulator test verifies the classless-wrapper suspicion. With the same StyleSheet UI, enabling
the Uniwind wrapper adds 22.32 ms on Android and 27.65 ms on iOS to the median result.

PR 640 removes most of that classless overhead on Android and nearly all of it on iOS:
`mixed-pr640` finishes within 3.96 ms of the Android StyleSheet median and within 0.11 ms on iOS.
Fully class-based Community and Pro trees do not show a clear change because their paired
confidence intervals include zero.

## Reproduction

Build PR 640 in a sibling `uniwind` checkout at the revision above, then:

```sh
bun install
bun benchmark:verify-pr640

bun benchmark:build --platform android
bun benchmark:run --platform android --device <adb-serial> --rounds 14

bun benchmark:build --platform ios --device <simulator-udid>
bun benchmark:run --platform ios --device <simulator-udid> --rounds 14
```

Each platform directory contains `summary.csv`, `comparisons.csv`, `summary.json`, and all raw
round logs.
