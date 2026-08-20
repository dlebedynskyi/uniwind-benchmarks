# Uniwind Metro Wrapper Scaling Test

Run date: 2026-08-20

## Environment

- Repository commit: `7413dcbef8c0b25654cb2f9f2080d4714331bd89`
- React Native: `0.82.0`
- Uniwind: `1.3.0`
- Build: Android release, Hermes, Fabric/new architecture, arm64
- Emulator: Android 15 / API 35, arm64, 2 vCPUs, 2.5 GB guest RAM
- Display: 1080 x 2220 at 440 dpi
- Emulator UI animations: disabled

The emulator constrains CPU count and memory, but its CPU frequency and cache behavior do not
faithfully model a physical low-end SoC. Use the relative results to identify where costs occur,
then validate absolute latency on target hardware.

## Variants

1. `t1-raw-stylesheet`: raw React Native imports with the shared StyleSheet tree.
2. `t2-uniwind-wrapper-stylesheet`: `withUniwindConfig` enabled with the exact same shared
   StyleSheet tree as T1.
3. `t3-uniwind-classnames`: `withUniwindConfig` enabled with equivalent className styles.

T1 and T2 import the same `renderStyleSheetTree` function. Metro resolution is the only rendering
difference.

## Method

- Item counts: 100, 250, 500, 1000, and 2000.
- Each item contains one `View` and one `Text`.
- Reported public node count is `items * 2 + 1` for the `ScrollView`.
- Each case uses 2 warm-up mounts followed by 7 measured mounts.
- Each variant starts in a fresh app process.
- Timing starts immediately before scheduling the mount and ends in a sibling layout effect after
  the React commit.
- Results measure mount-to-commit latency, not first painted frame time.

## Results

Median mount time:

| Items | Public nodes | Raw StyleSheet | Wrapped StyleSheet | Uniwind className |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 201 | 9.61 ms | 15.21 ms | 11.74 ms |
| 250 | 501 | 21.09 ms | 33.02 ms | 32.27 ms |
| 500 | 1001 | 38.68 ms | 56.41 ms | 54.97 ms |
| 1000 | 2001 | 67.52 ms | 88.52 ms | 90.34 ms |
| 2000 | 4001 | 167.20 ms | 198.23 ms | 237.02 ms |

Delta from raw:

| Items | Wrapper delta | Wrapper ratio | className delta | className ratio |
| ---: | ---: | ---: | ---: | ---: |
| 100 | +5.60 ms | 1.58x | +2.13 ms | 1.22x |
| 250 | +11.93 ms | 1.57x | +11.18 ms | 1.53x |
| 500 | +17.73 ms | 1.46x | +16.29 ms | 1.42x |
| 1000 | +21.00 ms | 1.31x | +22.82 ms | 1.34x |
| 2000 | +31.03 ms | 1.19x | +69.81 ms | 1.42x |

Raw sample logs are in this directory. `summary.csv` contains the medians in machine-readable form.

## Interpretation

The wrapper has a measurable cost without className. Through 1000 items, T2 and T3 are nearly the
same, which indicates that the globally inserted React wrappers and hooks dominate more than class
lookup in this scenario.

The data does not show exponential wrapper complexity:

- Linear fits across all five sizes have R-squared values of 0.99 raw, 0.99 wrapped, and 0.98
  className.
- Log-log power exponents are 0.93 raw, 0.83 wrapped, and 0.96 className.
- The wrapper's absolute cost grows with the tree, but its measured cost per public node falls as
  the tree grows.

There is a high-node-count knee in every variant. Relative to the linear trend fitted through 1000
items, the 2000-item result is 26% high for raw, 16% high for wrapped StyleSheet, and 34% high for
className. The className path therefore adds a separate large-tree pressure point even though it is
close to T2 at smaller sizes.

The most likely explanation is threshold behavior, not an exponential algorithm: larger React
fiber and hook lists, more temporary arrays/props, Fabric commit work, Yoga layout, and garbage
collection cross memory and scheduling thresholds. Slower physical devices can amplify those
thresholds enough to look nonlinear in user-visible latency.

## Source-Level Cause

Uniwind's Metro resolver redirects each eligible `react-native` import to `uniwind/components`.
That changes every supported React Native element in application code, whether it has a className
or not.

In Uniwind 1.3.0:

- Every wrapped `View` adds a function-component fiber and calls `useStyle`.
- `useStyle` always allocates a reducer hook, calls the store, and registers an effect hook.
- Every wrapped `Text` adds local pressed state and calls `useStyle` twice.
- `ScrollView` calls `useStyle` three times.
- Every wrapper creates style arrays and spreads props before rendering the raw RN component.

The no-class store lookup itself is fast and returns a shared empty result. It does not remove the
wrapper fiber or hook allocation.

For className values, style resolution is cached by class/state key after the first lookup. Cached
style objects still expose properties through getters, and each component still creates wrapper
props/style arrays. At very large counts, those operations and native prop serialization are a
plausible source of the additional T3 knee.

## Recommended Fix

Move the gate before React creates the component fiber:

1. Keep raw React Native components as the normal `react-native` exports.
2. Add a Metro/Babel JSX transform or custom JSX runtime.
3. When an element has a Uniwind prop such as `className`, `contentContainerClassName`, or
   `colorClassName`, substitute the matching Uniwind component type before calling React's JSX
   runtime.
4. Leave elements without Uniwind props on the raw component type.
5. Conservatively use the wrapped component when a prop spread makes the presence of Uniwind props
   unknowable at compile time.

This makes classless JSX converge on T1 and keeps styled JSX at the current two-fiber shape:
`UniwindView -> RNView`. It avoids the runtime dispatcher shape
`Dispatcher -> UniwindView -> RNView`, which explains the reported regression for styled nodes.

Additional improvements:

- Resolve all class-derived props for a component with one subscription hook instead of two for
  `Text` and three for `ScrollView`.
- Strip consumed `*ClassName` props before forwarding props to the RN component.
- Materialize dependency-free cached styles as plain frozen values rather than accessor-backed
  objects.
- Add Metro include/exclude controls or an explicit raw-RN escape hatch for dense third-party
  subtrees while an element-level transform is developed.

## Reproduction

Build:

```sh
cd apps/stylesheet/android
./gradlew clean assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon

cd ../../uniwind/android
./gradlew clean assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
```

Select the wrapped app scenario with an Android launch extra:

```sh
adb shell am start -W -n com.uniwind/.MainActivity --es benchmarkVariant stylesheet
adb shell am start -W -n com.uniwind/.MainActivity --es benchmarkVariant uniwind
```

Filter results:

```sh
adb logcat -d -v raw ReactNativeJS:I '*:S' | rg UNIWIND_BENCHMARK
```
