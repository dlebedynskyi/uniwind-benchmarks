const { existsSync, realpathSync } = require('node:fs')
const path = require('node:path')

const RAW_COMPONENTS_MODULE = 'uniwind/.internal/raw-components'
const OPTIMIZE_ENV = 'UNIWIND_OPTIMIZE_CLASSLESS_COMPONENTS'

function isOptimizationEnabled() {
  return ['1', 'true'].includes(String(process.env[OPTIMIZE_ENV]).toLowerCase())
}

function getPr640PackageRoot() {
  const configuredRoot = process.env.UNIWIND_PR640_PACKAGE_ROOT
  const packageRoot = configuredRoot
    ? path.resolve(configuredRoot)
    : path.resolve(__dirname, '../../../../uniwind/packages/uniwind')

  const requiredFiles = [
    'dist/metro/index.cjs',
    'dist/metro/babel-transformer.cjs',
    'src/bundler/adapters/metro/raw-components.ts',
  ]

  for (const relativePath of requiredFiles) {
    if (!existsSync(path.join(packageRoot, relativePath))) {
      throw new Error(
        `PR 640 package is missing ${relativePath}. Build it first or set UNIWIND_PR640_PACKAGE_ROOT.`
      )
    }
  }

  return realpathSync(packageRoot)
}

function withCommunityPr640(config, { baselineWithUniwindConfig, ...uniwindOptions }) {
  if (!isOptimizationEnabled()) {
    return baselineWithUniwindConfig(config, uniwindOptions)
  }

  const packageRoot = getPr640PackageRoot()
  const { withUniwindConfig } = require(path.join(packageRoot, 'dist/metro/index.cjs'))
  const upstreamResolver = config.resolver?.resolveRequest
  const watchedConfig = {
    ...config,
    watchFolders: [...new Set([...(config.watchFolders ?? []), packageRoot])],
    resolver: {
      ...config.resolver,
      resolveRequest: (context, moduleName, platform) => {
        const resolver = upstreamResolver ?? context.resolveRequest

        if (moduleName === 'uniwind') {
          return {
            type: 'sourceFile',
            filePath: path.join(packageRoot, 'src/index.ts'),
          }
        }

        if (moduleName === 'uniwind/components') {
          return {
            type: 'sourceFile',
            filePath: path.join(packageRoot, 'src/components/index.ts'),
          }
        }

        if (moduleName.startsWith('uniwind/components/')) {
          return {
            type: 'sourceFile',
            filePath: path.join(
              packageRoot,
              'src/components/native',
              `${moduleName.slice('uniwind/components/'.length)}.tsx`
            ),
          }
        }

        return resolver(context, moduleName, platform)
      },
    },
  }

  return withUniwindConfig(watchedConfig, {
    ...uniwindOptions,
    experimental: {
      ...uniwindOptions.experimental,
      optimizeClasslessComponents: true,
    },
  })
}

function withProPr640(config, { baselineWithUniwindConfig, ...uniwindOptions }) {
  const configured = baselineWithUniwindConfig(config, uniwindOptions)

  if (!isOptimizationEnabled()) {
    return configured
  }

  const packageRoot = getPr640PackageRoot()
  const rawComponentsPath = path.join(packageRoot, 'src/bundler/adapters/metro/raw-components.ts')
  const babelTransformerPath = path.join(packageRoot, 'dist/metro/babel-transformer.cjs')
  const upstreamTransformerPath = configured.transformerPath
  const upstreamResolver = configured.resolver?.resolveRequest
  const baseResolver = config.resolver?.resolveRequest

  if (typeof upstreamTransformerPath !== 'string' || typeof upstreamResolver !== 'function') {
    throw new Error(
      'PR 640 Pro bridge requires a configured Uniwind Metro transformer and resolver.'
    )
  }

  return {
    ...configured,
    watchFolders: [...new Set([...(configured.watchFolders ?? []), packageRoot])],
    transformerPath: require.resolve('./pr640-transformer.cjs'),
    transformer: {
      ...configured.transformer,
      pr640: {
        babelTransformerPath,
        upstreamTransformerPath,
      },
    },
    resolver: {
      ...configured.resolver,
      resolveRequest: (context, moduleName, platform) => {
        if (moduleName === RAW_COMPONENTS_MODULE) {
          return {
            type: 'sourceFile',
            filePath: rawComponentsPath,
          }
        }

        if (context.originModulePath === rawComponentsPath && moduleName === 'react-native') {
          return (baseResolver ?? context.resolveRequest)(context, moduleName, platform)
        }

        return upstreamResolver(context, moduleName, platform)
      },
    },
  }
}

module.exports = {
  isOptimizationEnabled,
  withCommunityPr640,
  withProPr640,
}
