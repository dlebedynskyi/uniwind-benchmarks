import { ScalingBenchmark, renderStyleSheetTree } from '@uniwind-benchmarks/benchmark'

function App() {
  return <ScalingBenchmark variant="t1-raw-stylesheet" renderTree={renderStyleSheetTree} />
}

export default App
