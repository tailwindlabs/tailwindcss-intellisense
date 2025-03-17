const os = require('os')
const path = require('path')
const fs = require('fs')

const vars = (process.config && process.config.variables) || {}
const arch = os.arch()
const platform = os.platform()
const abi = process.versions.modules
const runtime = isElectron() ? 'electron' : 'node'
const libc = process.env.LIBC || (isAlpine(platform) ? 'musl' : 'glibc')
const armv = process.env.ARM_VERSION || (arch === 'arm64' ? '8' : vars.arm_version) || ''
const uv = (process.versions.uv || '').split('.')[0]

const prebuilds = {
  'darwin-arm64': {
    'node.napi.glibc.node': () => require('@parcel/watcher-darwin-arm64/watcher.node'),
  },
  'darwin-x64': {
    'node.napi.glibc.node': () => require('@parcel/watcher-darwin-x64/watcher.node'),
  },
  'linux-x64': {
    'node.napi.glibc.node': () => require('@parcel/watcher-linux-x64-glibc/watcher.node'),
    'node.napi.musl.node': () => require('@parcel/watcher-linux-x64-musl/watcher.node'),
  },
  'linux-arm64': {
    'node.napi.glibc.node': () => require('@parcel/watcher-linux-arm64-glibc/watcher.node'),
    'node.napi.musl.node': () => require('@parcel/watcher-linux-arm64-musl/watcher.node'),
  },
  'win32-x64': {
    'node.napi.glibc.node': () => require('@parcel/watcher-win32-x64/watcher.node'),
  },
  'win32-arm64': {
    'node.napi.glibc.node': () => require('@parcel/watcher-win32-arm64/watcher.node'),
  },
}

let getBinding = () => {
  let resolved = resolve()
  getBinding = () => resolved
  return resolved
}

exports.getBinding = getBinding

exports.writeSnapshot = (dir, snapshot, opts) => {
  return getBinding().writeSnapshot(
    path.resolve(dir),
    path.resolve(snapshot),
    normalizeOptions(dir, opts),
  )
}

exports.getEventsSince = (dir, snapshot, opts) => {
  return getBinding().getEventsSince(
    path.resolve(dir),
    path.resolve(snapshot),
    normalizeOptions(dir, opts),
  )
}

exports.subscribe = async (dir, fn, opts) => {
  dir = path.resolve(dir)
  opts = normalizeOptions(dir, opts)
  await getBinding().subscribe(dir, fn, opts)

  return {
    unsubscribe() {
      return getBinding().unsubscribe(dir, fn, opts)
    },
  }
}

exports.unsubscribe = (dir, fn, opts) => {
  return getBinding().unsubscribe(path.resolve(dir), fn, normalizeOptions(dir, opts))
}

function resolve() {
  // Find matching "prebuilds/<platform>-<arch>" directory
  var tuples = Object.keys(prebuilds).map(parseTuple)
  var tuple = tuples.filter(matchTuple(platform, arch)).sort(compareTuples)[0]
  if (!tuple) return

  // Find most specific flavor first
  var list = prebuilds[tuple.name]
  var builds = Object.keys(list)
  var parsed = builds.map(parseTags)
  var candidates = parsed.filter(matchTags(runtime, abi))
  var winner = candidates.sort(compareTags(runtime))[0]
  if (winner) {
    try {
      return list[winner.file]()
    } catch (_error) {}
  }
}

function parseTuple(name) {
  // Example: darwin-x64+arm64
  var arr = name.split('-')
  if (arr.length !== 2) return

  var platform = arr[0]
  var architectures = arr[1].split('+')

  if (!platform) return
  if (!architectures.length) return
  if (!architectures.every(Boolean)) return

  return { name, platform, architectures }
}

function matchTuple(platform, arch) {
  return function (tuple) {
    if (tuple == null) return false
    if (tuple.platform !== platform) return false
    return tuple.architectures.includes(arch)
  }
}

function compareTuples(a, b) {
  // Prefer single-arch prebuilds over multi-arch
  return a.architectures.length - b.architectures.length
}

function parseTags(file) {
  var arr = file.split('.')
  var extension = arr.pop()
  var tags = { file: file, specificity: 0 }

  if (extension !== 'node') return

  for (var i = 0; i < arr.length; i++) {
    var tag = arr[i]

    if (tag === 'node' || tag === 'electron' || tag === 'node-webkit') {
      tags.runtime = tag
    } else if (tag === 'napi') {
      tags.napi = true
    } else if (tag.slice(0, 3) === 'abi') {
      tags.abi = tag.slice(3)
    } else if (tag.slice(0, 2) === 'uv') {
      tags.uv = tag.slice(2)
    } else if (tag.slice(0, 4) === 'armv') {
      tags.armv = tag.slice(4)
    } else if (tag === 'glibc' || tag === 'musl') {
      tags.libc = tag
    } else {
      continue
    }

    tags.specificity++
  }

  return tags
}

function matchTags(runtime, abi) {
  return function (tags) {
    if (tags == null) return false
    if (tags.runtime !== runtime && !runtimeAgnostic(tags)) return false
    if (tags.abi !== abi && !tags.napi) return false
    if (tags.uv && tags.uv !== uv) return false
    if (tags.armv && tags.armv !== armv) return false
    if (tags.libc && tags.libc !== libc) return false

    return true
  }
}

function runtimeAgnostic(tags) {
  return tags.runtime === 'node' && tags.napi
}

function compareTags(runtime) {
  // Precedence: non-agnostic runtime, abi over napi, then by specificity.
  return function (a, b) {
    if (a.runtime !== b.runtime) {
      return a.runtime === runtime ? -1 : 1
    } else if (a.abi !== b.abi) {
      return a.abi ? -1 : 1
    } else if (a.specificity !== b.specificity) {
      return a.specificity > b.specificity ? -1 : 1
    } else {
      return 0
    }
  }
}

function normalizeOptions(dir, opts = {}) {
  if (Array.isArray(opts.ignore)) {
    opts = Object.assign({}, opts, {
      ignore: opts.ignore.map((ignore) => path.resolve(dir, ignore)),
    })
  }

  return opts
}

function isElectron() {
  if (process.versions && process.versions.electron) return true
  if (process.env.ELECTRON_RUN_AS_NODE) return true
  return typeof window !== 'undefined' && window.process && window.process.type === 'renderer'
}

function isAlpine(platform) {
  return platform === 'linux' && fs.existsSync('/etc/alpine-release')
}
