import * as fs from 'fs'
import Color from 'color'
import tmp from 'tmp'

export function createTempFile(content: string, options = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    tmp.file(options, (err, path) => {
      if (err) return reject(err)
      fs.writeFile(path, content, { encoding: 'utf8' }, err => {
        if (err) return reject(err)
        resolve(path)
      })
    })
  })
}

export function getSvgColorFromValue(value: string): string {
  if (typeof value !== 'string') return null

  if (value === 'transparent') {
    return 'none'
  }

  try {
    let parsed = Color(value)
    if (parsed.valpha === 0) return 'none'
    return parsed.rgb().string()
  } catch (err) {
    return null
  }
}
