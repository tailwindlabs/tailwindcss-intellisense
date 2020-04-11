let postcss = require('postcss')
const esmImport = require('esm')(module)
const process = esmImport('../src/extractClassNames.mjs').default
postcss = postcss([postcss.plugin('no-op', () => () => {})])

const processCss = async css =>
  process(await postcss.process(css, { from: undefined }))

test('foo', async () => {
  const result = await processCss(`
    @media (min-width: 640px) {
      .sm__TAILWIND_SEPARATOR__bg-red {
        background-color: red;
      }
      .sm__TAILWIND_SEPARATOR__hover__TAILWIND_SEPARATOR__bg-red:hover {
        background-color: red;
      }
    }
    .hover__TAILWIND_SEPARATOR__bg-red:hover {
      background-color: red;
    }
  `)

  expect(result).toEqual({
    context: {
      sm: ['@media (min-width: 640px)'],
      hover: [':hover']
    },
    classNames: {
      sm: {
        'bg-red': {
          __rule: true,
          '@media (min-width: 640px)': {
            __decls: true,
            'background-color': 'red'
          }
        },
        hover: {
          'bg-red': {
            __rule: true,
            '@media (min-width: 640px)': {
              __decls: true,
              __pseudo: [':hover'],
              'background-color': 'red'
            }
          }
        }
      },
      hover: {
        'bg-red': {
          __rule: true,
          __decls: true,
          __pseudo: [':hover'],
          'background-color': 'red'
        }
      }
    }
  })
})

test('processes basic css', async () => {
  const result = await processCss(`
    .bg-red {
      background-color: red;
    }
  `)

  expect(result).toEqual({
    context: {},
    classNames: {
      'bg-red': {
        __rule: true,
        __decls: true,
        'background-color': 'red'
      }
    }
  })
})

test('processes pseudo selectors', async () => {
  const result = await processCss(`
    .bg-red:first-child::after {
      background-color: red;
    }
  `)

  expect(result).toEqual({
    context: {},
    classNames: {
      'bg-red': {
        __rule: true,
        __decls: true,
        __pseudo: [':first-child', '::after'],
        'background-color': 'red'
      }
    }
  })
})

test('processes pseudo selectors in scope', async () => {
  const result = await processCss(`
    .scope:hover .bg-red {
      background-color: red;
    }
  `)

  expect(result).toEqual({
    context: {},
    classNames: {
      scope: {
        __pseudo: [':hover']
      },
      'bg-red': {
        __rule: true,
        __decls: true,
        __scope: '.scope:hover',
        'background-color': 'red'
      }
    }
  })
})

test('processes multiple class names in the same rule', async () => {
  const result = await processCss(`
    .bg-red,
    .bg-red-again {
      background-color: red;
    }
  `)

  expect(result).toEqual({
    context: {},
    classNames: {
      'bg-red': {
        __rule: true,
        __decls: true,
        'background-color': 'red'
      },
      'bg-red-again': {
        __rule: true,
        __decls: true,
        'background-color': 'red'
      }
    }
  })
})

test('processes media queries', async () => {
  const result = await processCss(`
    @media (min-width: 768px) {
      .bg-red {
        background-color: red;
      }
    }
  `)

  expect(result).toEqual({
    context: {},
    classNames: {
      'bg-red': {
        __rule: true,
        '@media (min-width: 768px)': {
          __decls: true,
          'background-color': 'red'
        }
      }
    }
  })
})

test('merges declarations', async () => {
  const result = await processCss(`
    .bg-red {
      background-color: red;
    }
    .bg-red {
      color: white;
    }
  `)

  expect(result).toEqual({
    context: {},
    classNames: {
      'bg-red': {
        __rule: true,
        __decls: true,
        'background-color': 'red',
        color: 'white'
      }
    }
  })
})

test('processes class name scope', async () => {
  const result = await processCss(`
    .scope .bg-red {
      background-color: red;
    }
  `)

  expect(result).toEqual({
    context: {},
    classNames: {
      scope: {},
      'bg-red': {
        __rule: true,
        __decls: true,
        __scope: '.scope',
        'background-color': 'red'
      }
    }
  })
})

test('processes multiple scopes for the same class name', async () => {
  const result = await processCss(`
    .scope1 .bg-red {
      background-color: red;
    }
    .scope2 + .bg-red {
      background-color: red;
    }
    .scope3 > .bg-red {
      background-color: red;
    }
  `)

  expect(result).toEqual({
    context: {},
    classNames: {
      scope1: {},
      scope2: {},
      scope3: {},
      'bg-red': [
        {
          __rule: true,
          __decls: true,
          __scope: '.scope1',
          'background-color': 'red'
        },
        {
          __rule: true,
          __decls: true,
          __scope: '.scope2 +',
          'background-color': 'red'
        },
        {
          __rule: true,
          __decls: true,
          __scope: '.scope3 >',
          'background-color': 'red'
        }
      ]
    }
  })
})
