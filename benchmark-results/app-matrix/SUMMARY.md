# PR 640 App Matrix Summary

The 18-round Android and iOS simulator matrix verifies the suspicion that Uniwind wrappers impose a
material cost on large classless trees. The test uses the same 1,000-item StyleSheet UI with no
wrapper, Community, and Pro, each with PR 640 disabled and enabled where applicable.

| Classless comparison | Off median | On median | Paired mean delta (95% CI) |
| --- | ---: | ---: | ---: |
| Android Community | 85.78 ms | 65.46 ms | -19.45 ms (-21.82 to -17.09) |
| Android Pro | 91.44 ms | 65.82 ms | -25.13 ms (-26.53 to -23.73) |
| iOS Community | 80.94 ms | 52.92 ms | -28.14 ms (-28.78 to -27.49) |
| iOS Pro | 79.32 ms | 53.89 ms | -25.02 ms (-25.74 to -24.31) |

The StyleSheet controls were 66.29 ms on Android and 53.71 ms on iOS. With PR 640 enabled, every
classless variant was within 0.84 ms of its platform control.

Fully class-based Community and Pro trees were effectively unchanged; all paired 95% confidence
intervals include zero. This supports compile-time raw-component selection for provably classless
elements without showing a measurable regression for styled elements.

The result applies to this 1,000-item simulator workload. It does not establish exponential scaling
or reproduce absolute physical low-end-device latency.

See the [full report](./README.md), [Android data](./android/), and [iOS data](./ios/).
