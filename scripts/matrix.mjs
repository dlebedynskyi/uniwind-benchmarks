export const PR640_COMMIT = '24fd45663090281e43bb8637debe231219e640e1'

const apps = {
  stylesheet: {
    androidPackage: 'com.stylesheet',
    app: 'stylesheet',
    iosBundleId: 'org.reactjs.native.example.stylesheet',
    iosProduct: 'stylesheet',
    iosScheme: 'stylesheet',
  },
  mixed: {
    androidPackage: 'com.mixed',
    app: 'mixed',
    iosBundleId: 'org.reactjs.native.example.mixed',
    iosProduct: 'mixed',
    iosScheme: 'mixed',
  },
  uniwind: {
    androidPackage: 'com.uniwind',
    app: 'uniwind',
    iosBundleId: 'org.reactjs.native.example.uniwind',
    iosProduct: 'uniwind',
    iosScheme: 'uniwind',
  },
  'uniwind-pro': {
    androidPackage: 'com.uniwindpro',
    app: 'uniwind-pro',
    iosBundleId: 'org.reactjs.native.example.uniwindpro',
    iosProduct: 'uniwindpro',
    iosScheme: 'uniwindpro',
  },
}

export const variants = [
  { id: 'stylesheet', optimize: false, ...apps.stylesheet },
  { id: 'mixed', optimize: false, ...apps.mixed },
  { id: 'mixed-pr640', optimize: true, ...apps.mixed },
  { id: 'uniwind', optimize: false, ...apps.uniwind },
  { id: 'uniwind-pr640', optimize: true, ...apps.uniwind },
  { id: 'uniwind-pro', optimize: false, ...apps['uniwind-pro'] },
  { id: 'uniwind-pro-pr640', optimize: true, ...apps['uniwind-pro'] },
]

export function getVariant(id) {
  const variant = variants.find((candidate) => candidate.id === id)
  if (!variant) {
    throw new Error(`Unknown variant "${id}". Expected one of: ${variants.map((v) => v.id).join(', ')}`)
  }
  return variant
}

export function getRoundOrder(round) {
  const count = variants.length
  const base = [0]

  for (let offset = 1; offset <= Math.floor(count / 2); offset += 1) {
    base.push(offset, count - offset)
  }

  const rotation = (round - 1) % count
  const reversed = Math.floor((round - 1) / count) % 2 === 1
  const order = base.map((index) => variants[(index + rotation) % count])

  return reversed ? order.reverse() : order
}
