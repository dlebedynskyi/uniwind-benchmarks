import './global.css'
import { ScalingBenchmark, renderStyleSheetTree } from '@uniwind-benchmarks/benchmark'
import { ScrollView, Text, View } from 'react-native'

type BenchmarkVariant = 'stylesheet' | 'uniwind'

interface AppProps {
  benchmarkVariant?: BenchmarkVariant
}

function renderUniwindTree(itemCount: number) {
  return (
    <ScrollView
      contentContainerClassName="gap-2 flex-row flex-wrap"
      showsVerticalScrollIndicator={false}
    >
      {Array.from({ length: itemCount }, (_, index) => (
        <View
          key={index}
          className="w-[32%] h-[100px] rounded-[16px] bg-[#00a8ff] items-center justify-center"
        >
          <Text className="text-black text-base font-bold">{index}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

function App({ benchmarkVariant = 'stylesheet' }: AppProps) {
  if (benchmarkVariant === 'uniwind') {
    return <ScalingBenchmark variant="t3-uniwind-classnames" renderTree={renderUniwindTree} />
  }

  return (
    <ScalingBenchmark variant="t2-uniwind-wrapper-stylesheet" renderTree={renderStyleSheetTree} />
  )
}

export default App
