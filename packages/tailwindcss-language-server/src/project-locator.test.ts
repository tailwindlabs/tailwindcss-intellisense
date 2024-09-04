import { test } from 'vitest'
import * as path from 'node:path'
import { ProjectLocator } from './project-locator'
import { URL, fileURLToPath } from 'url'
import { Settings } from '@tailwindcss/language-service/src/util/state'

let settings: Settings = {
  tailwindCSS: {
    files: {
      exclude: [],
    },
  },
} as any

function testFixture(fixture: string, details: any[]) {
  let fixtures = fileURLToPath(new URL('../tests/fixtures', import.meta.url))
  let fixturePath = `${fixtures}/${fixture}`

  test.concurrent(fixture, async ({ expect }) => {
    let locator = new ProjectLocator(fixturePath, settings)
    let projects = await locator.search()

    for (let i = 0; i < Math.max(projects.length, details.length); i++) {
      let project = projects[i]
      expect(project).toBeDefined()

      let detail = details[i]

      let configPath = path.relative(fixturePath, project.config.path)

      expect(configPath).toEqual(detail?.config)

      if (detail?.content) {
        let expected = detail?.content.map((path) => path.replace('{URL}', fixturePath)).sort()

        let actual = project.documentSelector
          .filter((selector) => selector.priority === 1 /** content */)
          .map((selector) => selector.pattern)
          .sort()

        expect(actual).toEqual(expected)
      }

      if (detail?.selectors) {
        let expected = detail?.selectors.map((path) => path.replace('{URL}', fixturePath)).sort()

        let actual = project.documentSelector.map((selector) => selector.pattern).sort()

        expect(actual).toEqual(expected)
      }
    }

    expect(projects).toHaveLength(details.length)
  })
}

testFixture('basic', [
  //
  { config: 'tailwind.config.js' },
])

testFixture('dependencies', [
  //
  { config: 'tailwind.config.js' },
])

testFixture('multi-config', [
  //
  { config: 'one/tailwind.config.js' },
  { config: 'two/tailwind.config.js' },
])

testFixture('multi-config-content', [
  //
  { config: 'tailwind.config.one.js' },
  { config: 'tailwind.config.two.js' },
])

testFixture('v3/esm-config', [
  //
  { config: 'tailwind.config.mjs' },
])

testFixture('v3/ts-config', [
  //
  { config: 'tailwind.config.ts' },
])

testFixture('v3/cts-config', [
  //
  { config: 'tailwind.config.cts' },
])

testFixture('v3/mts-config', [
  //
  { config: 'tailwind.config.mts' },
])

testFixture('v4/basic', [
  //
  { config: 'app.css' },
])

testFixture('v4/multi-config', [
  //
  { config: 'admin/app.css' },
  { config: 'web/app.css' },
])

testFixture('v4/workspaces', [
  {
    config: 'packages/admin/app.css',
    selectors: [
      '{URL}/node_modules/tailwindcss/**',
      '{URL}/node_modules/tailwindcss/index.css',
      '{URL}/node_modules/tailwindcss/theme.css',
      '{URL}/node_modules/tailwindcss/utilities.css',
      '{URL}/packages/admin/**',
      '{URL}/packages/admin/app.css',
      '{URL}/packages/admin/package.json',
    ],
  },
  {
    config: 'packages/web/app.css',
    selectors: [
      '{URL}/node_modules/tailwindcss/**',
      '{URL}/node_modules/tailwindcss/index.css',
      '{URL}/node_modules/tailwindcss/theme.css',
      '{URL}/node_modules/tailwindcss/utilities.css',
      '{URL}/packages/style-export/**',
      '{URL}/packages/style-export/lib.css',
      '{URL}/packages/style-export/theme.css',
      '{URL}/packages/style-main-field/**',
      '{URL}/packages/style-main-field/lib.css',
      '{URL}/packages/web/**',
      '{URL}/packages/web/app.css',
      '{URL}/packages/web/package.json',
    ],
  },
])

testFixture('v4/auto-content', [
  //
  {
    config: 'src/app.css',
    content: [
      '{URL}/package.json',
      '{URL}/src/index.html',
      '{URL}/src/components/example.html',
      '{URL}/src/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
    ],
  },
])

testFixture('v4/custom-source', [
  //
  {
    config: 'admin/app.css',
    content: [
      '{URL}/admin/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
      '{URL}/admin/**/*.bin',
      '{URL}/admin/foo.bin',
      '{URL}/package.json',
      '{URL}/shared.html',
      '{URL}/web/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
    ],
  },
  {
    config: 'web/app.css',
    content: [
      '{URL}/admin/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
      '{URL}/web/*.bin',
      '{URL}/web/bar.bin',
      '{URL}/package.json',
      '{URL}/shared.html',
      '{URL}/web/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
    ],
  },
])
