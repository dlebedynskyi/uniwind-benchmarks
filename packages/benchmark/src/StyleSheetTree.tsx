import { ScrollView, StyleSheet, Text, View } from 'react-native'

export function renderStyleSheetTree(itemCount: number) {
  return (
    <ScrollView contentContainerStyle={styles.scrollView} showsVerticalScrollIndicator={false}>
      {Array.from({ length: itemCount }, (_, index) => (
        <View key={index} style={styles.item}>
          <Text style={styles.text}>{index}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    width: '32%',
    height: 100,
    borderRadius: 16,
    backgroundColor: '#00a8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
})
