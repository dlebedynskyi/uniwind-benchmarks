## Problem and result

We suspected that enabling `withUniwindConfig` has a negative mount-performance impact even for
React Native elements that use only `StyleSheet` and do not have className props. The concern was
that this fixed per-element cost becomes significant in large trees, especially on lower-end
devices.

I created an isolated Android simulator test with three variants:

1. Raw React Native with a shared StyleSheet tree.
2. `withUniwindConfig` with the exact same shared StyleSheet tree and JSX.
3. `withUniwindConfig` with the UI converted to equivalent className styles.

The simulator test verifies the wrapper-overhead suspicion. Variant 2 is consistently slower than
the raw baseline even though its rendered tree and styles are identical. Through 1,000 items,
wrapped StyleSheet and Uniwind className results are also nearly identical, suggesting that wrapper
components and their hooks dominate more than class lookup at these sizes.

The test does not show algorithmically exponential growth in the measured range. It does show a
large-tree threshold, especially on the className path. The simulator cannot reproduce the CPU and
cache behavior of a physical low-end device, so the absolute impact still needs device validation.

The complete harness, raw logs, results, and reproduction instructions are available in the
[`benchmark/uniwind-wrapper-scaling` branch](https://github.com/dlebedynskyi/uniwind-benchmarks/tree/benchmark/uniwind-wrapper-scaling).
The focused report is
[`benchmark-results/README.md`](https://github.com/dlebedynskyi/uniwind-benchmarks/blob/benchmark/uniwind-wrapper-scaling/benchmark-results/README.md).

## Focused scaling benchmark

Environment:

- Uniwind `1.3.0`
- React Native `0.82.0`
- Android release build, Hermes, Fabric/new architecture, arm64
- Android 15 / API 35 emulator
- 2 vCPUs and approximately 2.5 GB guest RAM
- 2 warm-up mounts and 7 measured mounts per tree size
- Fresh app process for each variant

Each item contains one `View` and one `Text`. Timing starts immediately before scheduling the mount
and ends in a layout effect after the React commit.

Median mount-to-commit time:

| Items | Public nodes | Raw StyleSheet | Wrapped StyleSheet | Uniwind className |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 201 | 9.61 ms | 15.21 ms | 11.74 ms |
| 250 | 501 | 21.09 ms | 33.02 ms | 32.27 ms |
| 500 | 1,001 | 38.68 ms | 56.41 ms | 54.97 ms |
| 1,000 | 2,001 | 67.52 ms | 88.52 ms | 90.34 ms |
| 2,000 | 4,001 | 167.20 ms | 198.23 ms | 237.02 ms |

At 1,000 items, enabling the wrapper while keeping the same StyleSheet JSX adds about 21 ms
(`1.31x`). The className version is only another 1.8 ms above that.

At 2,000 items, the wrapper-only delta is about 31 ms, while className adds another 38.8 ms over
the wrapped StyleSheet variant.

## Scaling interpretation

The tested results fit linear models well:

- Raw StyleSheet: R-squared `0.99`
- Wrapped StyleSheet: R-squared `0.99`
- Uniwind className: R-squared `0.98`

The log-log power exponents are `0.93`, `0.83`, and `0.96`, respectively. There is no evidence here
of an exponential algorithm in node count.

There is a high-node-count knee in all variants. Compared with the linear trend through 1,000
items, the 2,000-item result is:

- 26% above trend for raw StyleSheet
- 16% above trend for wrapped StyleSheet
- 34% above trend for className

My current interpretation is threshold behavior: larger fiber and hook lists, temporary
props/style arrays, Fabric commit work, Yoga layout, and GC pressure cross memory and scheduling
thresholds. A slower physical device can amplify that into a much larger user-visible pause.

## Source-level hypothesis

The native Metro resolver redirects eligible `react-native` imports to `uniwind/components`.
Consequently, supported RN elements become Uniwind function components whether they have a
className or not.

In Uniwind 1.3.0:

- Wrapped `View` always calls `useStyle`.
- `useStyle` always creates a reducer hook, calls the style store, and registers an effect hook.
- Wrapped `Text` adds pressed state and calls `useStyle` twice.
- Wrapped `ScrollView` calls `useStyle` three times.
- Wrappers create style arrays and spread props before rendering the underlying RN component.

The no-class lookup itself returns a shared empty result quickly, but it cannot remove the wrapper
fiber or hook allocation.

For className values, resolved styles are cached after the first lookup, so repeated parsing does
not appear to be the dominant cost. Cached style objects still use property getters and every node
still pays for wrapper props, arrays, and native prop serialization. That may explain some of the
additional pressure at 2,000 items.

## Possible direction: gate before fiber creation

Could the dispatch happen at JSX transform/runtime level instead of inside a React component?

One possible design:

1. Keep raw RN components as the normal `react-native` exports.
2. Add a Metro/Babel JSX transform or custom JSX runtime.
3. If an element has a Uniwind prop such as `className`, `contentContainerClassName`, or
   `colorClassName`, substitute the matching Uniwind component type before invoking React's JSX
   runtime.
4. Otherwise keep the raw component type.
5. Conservatively wrap elements whose prop spreads make this unknowable at compile time.

That should make classless JSX converge toward raw RN while keeping styled JSX at
`UniwindView -> RNView`. It also avoids adding a runtime dispatcher fiber in front of styled
elements.

Some smaller complementary changes may also help:

- Resolve all class-derived props with one subscription hook per component instead of two for
  `Text` and three for `ScrollView`.
- Strip consumed `*ClassName` props before forwarding to RN.
- Materialize dependency-free cached styles as plain frozen values rather than accessor-backed
  objects.
- Add Metro include/exclude controls or an explicit raw-RN escape hatch for dense subtrees.

## Questions

- Does an element-level JSX transform/runtime fit Uniwind's compatibility goals?
- Are there important `createElement`, dynamic component, or module-resolution cases that make this
  approach impractical?
- Would a raw-component escape hatch or resolver include/exclude option be useful as an interim
  solution?

The branch includes the repeatable benchmark harness, per-run raw logs, and release APK build
setup.
