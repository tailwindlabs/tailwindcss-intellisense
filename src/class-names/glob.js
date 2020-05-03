import nodeGlob from 'glob'
import dlv from 'dlv'
import * as path from 'path'

export function glob(pattern, options = {}) {
  return new Promise((resolve, reject) => {
    let g = new nodeGlob.Glob(pattern, options)
    let matches = []
    let max = dlv(options, 'max', Infinity)
    g.on('match', (match) => {
      matches.push(path.resolve(options.cwd || process.cwd(), match))
      if (matches.length === max) {
        g.abort()
        resolve(matches)
      }
    })
    g.on('end', () => {
      resolve(matches)
    })
    g.on('error', reject)
  })
}
