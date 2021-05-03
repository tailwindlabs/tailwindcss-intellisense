let postcss = require('postcss')
const esmImport = require('esm')(module)
const process = esmImport('../src/class-names/extractClassNames.js')
postcss = postcss([postcss.plugin('no-op', () => () => {})])

const processCss = async (css) =>
  process(await postcss.process(css, { from: undefined }))

test('processes default container plugin', async () => {
  const result = await processCss(`
    .container {
      width: 100%
    }

    @media (min-width: 640px) {
      .container {
        max-width: 640px
      }
    }

    @media (min-width: 768px) {
      .container {
        max-width: 768px
      }
    }

    @media (min-width: 1024px) {
      .container {
        max-width: 1024px
      }
    }

    @media (min-width: 1280px) {
      .container {
        max-width: 1280px
      }
    }
  `)
  expect(result).toEqual({
    context: {},
    classNames: {
      container: [
        { __context: [], __rule: true, __scope: null, width: '100%' },
        {
          __rule: true,
          __scope: null,
          __context: ['@media (min-width: 640px)'],
          'max-width': '640px',
        },
        {
          __rule: true,
          __scope: null,
          __context: ['@media (min-width: 768px)'],
          'max-width': '768px',
        },
        {
          __rule: true,
          __scope: null,
          __context: ['@media (min-width: 1024px)'],
          'max-width': '1024px',
        },
        {
          __rule: true,
          __scope: null,
          __context: ['@media (min-width: 1280px)'],
          'max-width': '1280px',
        },
      ],
    },
  })
})

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
      hover: [':hover'],
    },
    classNames: {
      sm: {
        'bg-red': {
          __rule: true,
          __scope: null,
          __context: ['@media (min-width: 640px)'],
          'background-color': 'red',
        },
        hover: {
          'bg-red': {
            __rule: true,
            __scope: null,
            __context: ['@media (min-width: 640px)'],
            __pseudo: [':hover'],
            'background-color': 'red',
          },
        },
      },
      hover: {
        'bg-red': {
          __rule: true,
          __scope: null,
          __pseudo: [':hover'],
          __context: [],
          'background-color': 'red',
        },
      },
    },
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
        __scope: null,
        __context: [],
        'background-color': 'red',
      },
    },
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
        __scope: null,
        __context: [],
        __pseudo: [':first-child', '::after'],
        'background-color': 'red',
      },
    },
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
        __context: [],
        __pseudo: [':hover'],
        __scope: null,
      },
      'bg-red': {
        __context: [],
        __rule: true,
        __scope: '.scope:hover',
        'background-color': 'red',
      },
    },
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
        __scope: null,
        __context: [],
        'background-color': 'red',
      },
      'bg-red-again': {
        __rule: true,
        __scope: null,
        __context: [],
        'background-color': 'red',
      },
    },
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
        __scope: null,
        __context: ['@media (min-width: 768px)'],
        'background-color': 'red',
      },
    },
  })
})

test('processes nested at-rules', async () => {
  const result = await processCss(`
    @supports (display: grid) {
      @media (min-width: 768px) {
        .bg-red {
          background-color: red;
        }
      }
    }
  `)

  expect(result).toEqual({
    context: {},
    classNames: {
      'bg-red': {
        __rule: true,
        __scope: null,
        __context: ['@supports (display: grid)', '@media (min-width: 768px)'],
        'background-color': 'red',
      },
    },
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
        __scope: null,
        __context: [],
        'background-color': 'red',
        color: 'white',
      },
    },
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
      scope: {
        __context: [],
        __scope: null,
      },
      'bg-red': {
        __rule: true,
        __context: [],
        __scope: '.scope',
        'background-color': 'red',
      },
    },
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
      scope1: { __context: [], __scope: null },
      scope2: { __context: [], __scope: null },
      scope3: { __context: [], __scope: null },
      'bg-red': [
        {
          __rule: true,
          __context: [],
          __scope: '.scope1',
          'background-color': 'red',
        },
        {
          __rule: true,
          __context: [],
          __scope: '.scope2 +',
          'background-color': 'red',
        },
        {
          __rule: true,
          __context: [],
          __scope: '.scope3 >',
          'background-color': 'red',
        },
      ],
    },
  })
})

test('processes multiple properties of the same name', async () => {
  const result = await processCss(`
    .bg-red {
      background-color: blue;
      background-color: red;
    }
  `)

  expect(result).toEqual({
    context: {},
    classNames: {
      'bg-red': {
        __rule: true,
        __context: [],
        __scope: null,
        'background-color': ['blue', 'red'],
      },
    },
  })
})
