'use strict'

const transformerCache = new Map()

function loadTransformer(transformerPath) {
  const cached = transformerCache.get(transformerPath)
  if (cached) {
    return cached
  }

  const loaded = require(transformerPath)
  const transformer = typeof loaded.transform === 'function' ? loaded : loaded.default

  if (!transformer || typeof transformer.transform !== 'function') {
    throw new Error(`Invalid Metro transformer at ${transformerPath}`)
  }

  transformerCache.set(transformerPath, transformer)
  return transformer
}

async function transform(config, projectRoot, filePath, data, options) {
  const pr640 = config.pr640
  if (!pr640) {
    throw new Error('Missing PR 640 transformer configuration.')
  }

  const upstreamTransformer = loadTransformer(pr640.upstreamTransformerPath)
  const shouldOptimize =
    options.type !== 'asset' && options.platform !== 'web' && data.includes('react-native')

  if (!shouldOptimize) {
    return upstreamTransformer.transform(config, projectRoot, filePath, data, options)
  }

  return upstreamTransformer.transform(
    {
      ...config,
      babelTransformerPath: pr640.babelTransformerPath,
    },
    projectRoot,
    filePath,
    data,
    {
      ...options,
      customTransformOptions: {
        ...options.customTransformOptions,
        uniwind_transformComponents: true,
        uniwind_upstreamBabelTransformerPath: config.babelTransformerPath,
      },
    }
  )
}

module.exports = { transform }
