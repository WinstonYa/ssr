import { join } from 'path'
import { IConfig } from 'ssr-types'
import { getCwd, getUserConfig, normalizeStartPath, normalizeEndPath, getFeDir, judgeFramework, loadModuleFromFramework, stringifyDefine, accessFileSync } from './cwd'
import { coerce } from 'semver'

const loadConfig = (): IConfig => {
  const framework = judgeFramework()
  const userConfig = getUserConfig()
  const cwd = getCwd()
  const mode = 'ssr'
  const stream = false
  const isVite = process.env.BUILD_TOOL === 'vite' || accessFileSync(join(cwd, './build/originAsyncChunkMap.json'))
  const isCI = !!process.env.CI_TEST
  const vue3ServerEntry = join(cwd, './node_modules/ssr-plugin-vue3/esm/entry/server-entry.js')
  const vue3ClientEntry = join(cwd, './node_modules/ssr-plugin-vue3/esm/entry/client-entry.js')
  const vueServerEntry = join(cwd, './node_modules/ssr-plugin-vue/esm/entry/server-entry.js')
  const vueClientEntry = join(cwd, './node_modules/ssr-plugin-vue/esm/entry/client-entry.js')
  const reactServerEntry = join(cwd, './node_modules/ssr-plugin-react/esm/entry/server-entry.js')
  const reactClientEntry = join(cwd, './node_modules/ssr-plugin-react/esm/entry/client-entry.js')
  const supportOptinalChaining = coerce(process.version)!.major >= 14
  const define = userConfig.define ?? {}
  userConfig.define && stringifyDefine(define)

  const alias = Object.assign({
    '@': getFeDir(),
    '~': getCwd(),
    _build: join(getCwd(), './build')
  }, framework === 'ssr-plugin-react' ? {
    react: loadModuleFromFramework('react'),
    'react-router': loadModuleFromFramework('react-router'),
    'react-router-dom': loadModuleFromFramework('react-router-dom')
  } : {
    vue$: framework === 'ssr-plugin-vue' ? 'vue/dist/vue.runtime.esm.js' : 'vue/dist/vue.runtime.esm-bundler.js'
  }, userConfig.alias)

  type ClientLogLevel = 'error'
  const publicPath = userConfig.publicPath?.startsWith('http') ? userConfig.publicPath : normalizeStartPath(userConfig.publicPath ?? '/')

  const devPublicPath = publicPath.startsWith('http') ? publicPath.replace(/^http(s)?:\/\/(.*)?\d/, '') : publicPath // 本地开发不使用 http://localhost:3000 这样的 path 赋值给 webpack-dev-server 会很难处理

  const moduleFileExtensions = [
    '.web.mjs',
    '.mjs',
    '.web.js',
    '.js',
    '.web.ts',
    '.ts',
    '.web.tsx',
    '.tsx',
    '.json',
    '.web.jsx',
    '.jsx',
    '.vue',
    '.css'
  ]

  const isDev = userConfig.isDev ?? process.env.NODE_ENV !== 'production'

  const fePort = userConfig.fePort ?? 8999

  let https = userConfig.https ? userConfig.https : !!process.env.HTTPS

  if (!((typeof https === 'boolean' && https) || (typeof https === 'object' && Object.keys(https).length !== 0))) {
    https = false
  }

  const serverPort = process.env.SERVER_PORT ? Number(process.env.SERVER_PORT) : 3000

  const host = '127.0.0.1'

  const chunkName = 'Page'

  const clientLogLevel: ClientLogLevel = 'error'

  const useHash = !isDev // 生产环境默认生成hash
  const defaultWhiteList: Array<RegExp|string> = [/\.(css|less|sass|scss)$/, /vant.*?style/, /antd.*?(style)/, /ant-design-vue.*?(style)/, /store$/]
  const whiteList: Array<RegExp|string> = defaultWhiteList.concat(userConfig.whiteList ?? [])

  const jsOrder = isVite ? [`${chunkName}.js`] : [`runtime~${chunkName}.js`, 'vendor.js', `${chunkName}.js`]

  const cssOrder = ['vendor.css', `${chunkName}.css`]

  const webpackStatsOption = {
    assets: true, // 添加资源信息
    cachedAssets: false, // 显示缓存的资源（将其设置为 `false` 则仅显示输出的文件）
    children: false, // 添加 children 信息
    chunks: false, // 添加 chunk 信息（设置为 `false` 能允许较少的冗长输出）
    colors: true, // 以不同颜色区分构建信息
    modules: false, // 添加构建模块信息
    warnings: false,
    entrypoints: false
  }

  const dynamic = true
  // ref https://www.babeljs.cn/docs/babel-preset-env#corejs
  const corejsVersion = loadModuleFromFramework('core-js/package.json') && coerce(require(loadModuleFromFramework('core-js/package.json')).version)!.major
  const corejsOptions = userConfig.corejs ? {
    corejs: {
      version: corejsVersion,
      proposals: corejsVersion === 3
    },
    targets: {
      chrome: '60',
      firefox: '60',
      ie: '9',
      safari: '10',
      edge: '17'
    },
    useBuiltIns: 'usage',
    shippedProposals: corejsVersion === 2,
    ...userConfig.corejsOptions
  } : {}

  const getOutput = () => ({
    clientOutPut: join(cwd, './build/client'),
    serverOutPut: join(cwd, './build/server')
  })

  const webpackDevServerConfig = Object.assign({
    stats: webpackStatsOption,
    disableInfo: true, // 关闭webpack-dev-server 自带的server Info信息
    disableHostCheck: true,
    publicPath: devPublicPath,
    hotOnly: true,
    host,
    sockHost: host,
    sockPort: fePort,
    hot: true,
    port: fePort,
    https,
    clientLogLevel: clientLogLevel,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    }
  }, userConfig.webpackDevServerConfig)

  const chainBaseConfig = () => {
    // 覆盖默认webpack配置
  }
  const chainClientConfig = () => {
    // 覆盖默认 client webpack配置
  }
  const chainServerConfig = () => {
    // 覆盖默认 server webpack配置
  }

  const manifestPath = `${normalizeEndPath(devPublicPath)}asset-manifest.json`
  const staticPath = `${normalizeEndPath(devPublicPath)}static`
  const hotUpdatePath = `${normalizeEndPath(devPublicPath)}*.hot-update**`
  const proxyKey = [staticPath, hotUpdatePath, manifestPath]

  const config = Object.assign({}, {
    chainBaseConfig,
    chainServerConfig,
    chainClientConfig,
    cwd,
    isDev,
    publicPath,
    useHash,
    host,
    moduleFileExtensions,
    fePort,
    serverPort,
    chunkName,
    jsOrder,
    cssOrder,
    getOutput,
    webpackStatsOption,
    dynamic,
    mode,
    stream,
    https,
    manifestPath,
    proxyKey,
    vue3ServerEntry,
    vue3ClientEntry,
    vueServerEntry,
    vueClientEntry,
    reactServerEntry,
    reactClientEntry,
    isVite,
    whiteList,
    isCI,
    supportOptinalChaining,
    define
  }, userConfig)
  config.alias = alias
  config.corejsOptions = corejsOptions
  config.whiteList = whiteList
  config.webpackDevServerConfig = webpackDevServerConfig // 防止把整个 webpackDevServerConfig 全量覆盖了
  config.babelOptions = userConfig.babelOptions ? {
    ...{
      babelHelpers: 'bundled' as 'bundled',
      exclude: /node_modules|\.(css|less|sass)/,
      extensions: ['.ts', '.vue', '.tsx', '.js']
    },
    ...userConfig.babelOptions
  } : undefined

  return config
}

export {
  loadConfig
}
