const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { withUniwindConfig } = require('uniwind/metro')
const path = require('node:path')

const workspaceRoot = path.resolve(__dirname, '../../')

const defaultConfig = getDefaultConfig(__dirname)
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'react' || moduleName === 'react-native') {
        return context.resolveRequest(
          context,
          require.resolve(moduleName, { paths: [__dirname] }),
          platform
        )
      }

      return context.resolveRequest(context, moduleName, platform)
    },
  },
}
const mergedConfigs = mergeConfig(defaultConfig, config)

module.exports = withUniwindConfig(mergedConfigs, {
  cssEntryFile: './global.css',
  experimental: {
    optimizeClasslessComponents: true,
  },
})
