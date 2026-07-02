import * as path from 'node:path'
import { expect } from 'vitest'
import { loadTsConfig } from './tsconfig'
import { json, defineTest } from '../testing'
import { normalizePath } from '../utils'

defineTest({
  name: 'loadTsConfig respects excluded paths',
  fs: {
    'tsconfig.json': json`
      {
        "compilerOptions": {
          "baseUrl": "."
        }
      }
    `,
    'repos/ai/tsconfig.json': json`
      {
        "extends": "@vercel/ai-tsconfig/base.json"
      }
    `,
  },
  async handle({ root }) {
    let withoutExclude = await loadTsConfig(root)
    expect(withoutExclude.errors.length).toBeGreaterThan(0)

    let rootRelativeExclude = await loadTsConfig(root, {
      exclude: ['repos/**'],
    })
    expect(rootRelativeExclude.errors).toHaveLength(0)

    let rootAnchoredExclude = await loadTsConfig(root, {
      exclude: ['/repos/**'],
    })
    expect(rootAnchoredExclude.errors).toHaveLength(0)

    let absoluteExclude = await loadTsConfig(root, {
      exclude: [normalizePath(path.join(root, 'repos/**'))],
    })
    expect(absoluteExclude.errors).toHaveLength(0)
  },
})
