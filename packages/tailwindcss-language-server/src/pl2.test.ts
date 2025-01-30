import { expect } from 'vitest'
import { Settings } from '@tailwindcss/language-service/src/util/state'
import { defineTest, js, Storage, TestUtils } from './testing'
import { createResolver } from './resolver'
import { ProjectLocator } from './project-locator'

testLocator({
  name: 'v3, without npm',
  fs: {
    'tailwind.config.js': `module.exports = {}`,
  },
  expected: [{ version: '3.4.17 (bundled)', config: '/tailwind.config.js' }],
})

testLocator({
  name: 'v3, without npm, has deps',
  fs: {
    'tailwind.config.js': js`
      module.exports = {
        theme: {
          extend: {
            colors: require('./sub-dir/colors'),
          },
        },
      }
    `,
    'sub-dir/colors.js': js`
      module.exports = {
        foo: 'red',
      }
    `,
  },
  expected: [{ version: '3.4.17 (bundled)', config: '/tailwind.config.js' }],
})

testLocator({
  name: 'v4, without npm, uses fallback',
  fs: {
    'app.css': `@import "tailwindcss"`,
  },
  expected: [{ version: '4.0.0 (bundled)', config: '/app.css' }],
})

// ---

function testLocator({ name, fs, expected }: { name: string; fs: Storage; expected: any[] }) {
  defineTest({
    name,
    fs,
    prepare,
    async handle({ search }) {
      let projects = await search()

      let details = projects.map((project) => ({
        version: project.tailwind.isDefaultVersion
          ? `${project.tailwind.version} (bundled)`
          : project.tailwind.version,
        config: project.config.path,
        content: project.documentSelector
          .filter((selector) => selector.priority === 1 /** content */)
          .map((selector) => selector.pattern)
          .sort(),
        selectors: project.documentSelector.map((selector) => selector.pattern).sort(),
      }))

      expect(details).toMatchObject(expected)
    },
  })
}

async function prepare({ root }: TestUtils) {
  let settings = {
    tailwindCSS: {
      files: {
        exclude: [],
      },
    },
  } as Settings

  let resolver = await createResolver({ root, tsconfig: true })
  let locator = new ProjectLocator(root, settings, resolver)

  function adjustPath(filepath: string) {
    filepath = filepath.replace(root, '{URL}')

    if (filepath.startsWith('{URL}/')) {
      filepath = filepath.slice(5)
    }

    return filepath
  }

  async function search() {
    let projects = await locator.search()

    // Normalize all the paths for easier testing
    for (let project of projects) {
      project.folder = adjustPath(project.folder)
      project.configPath = adjustPath(project.configPath)

      // Config data
      project.config.path = adjustPath(project.config.path)
      project.config.packageRoot = adjustPath(project.config.packageRoot)
      for (let entry of project.config.entries) {
        entry.path = adjustPath(entry.path)
      }

      for (let selector of project.documentSelector ?? []) {
        selector.pattern = adjustPath(selector.pattern)
      }
    }

    return projects
  }

  return { search }
}
