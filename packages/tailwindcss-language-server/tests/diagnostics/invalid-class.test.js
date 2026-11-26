import { expect, test } from 'vitest'
import { withFixture } from '../common'

function createTestInline(c, defaultSettings = {}) {
  return function testInline(fixture, { code, expected, language = 'html', settings }) {
    settings = settings || defaultSettings
    test(fixture, async () => {
      let promise = new Promise((resolve) => {
        c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
          resolve(diagnostics)
        })
      })

      let doc = await c.openDocument({ text: code, lang: language, settings })
      let diagnostics = await promise

      expected = JSON.parse(JSON.stringify(expected).replaceAll('{{URI}}', doc.uri))

      expect(diagnostics).toEqual(expected)
    })
  }
}

withFixture('basic', (c) => {
  let testInline = createTestInline(c, {
    tailwindCSS: {
      lint: {
        invalidClass: 'warning'
      }
    }
  })

  testInline('invalid-class/simple', {
    code: '<div class="px-4 nonexistent-class"></div>',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'nonexistent-class',
          classList: {
            classList: 'px-4 nonexistent-class',
            range: {
              start: { line: 0, character: 12 },
              end: { line: 0, character: 34 }
            }
          },
          relativeRange: {
            start: { line: 0, character: 5 },
            end: { line: 0, character: 22 }
          },
          range: { start: { line: 0, character: 17 }, end: { line: 0, character: 34 } }
        },
        range: { start: { line: 0, character: 17 }, end: { line: 0, character: 34 } },
        severity: 2,
        message: "Unknown utility class 'nonexistent-class'."
      }
    ]
  })

  testInline('invalid-class/whitespace-negative', {
    code: '<div class="\n              px-4\n            "></div>',
    expected: []
  })

  testInline('invalid-class/variants-positive', {
    code: '<div class="hover:px-4"></div>',
    expected: []
  })

  testInline('invalid-class/variants', {
    code: '<div class="hover:nonexistent"></div>',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'hover:nonexistent',
          classList: {
            classList: 'hover:nonexistent',
            range: {
              start: { line: 0, character: 12 },
              end: { line: 0, character: 29 }
            }
          },
          range: {
            start: { line: 0, character: 12 },
            end: { line: 0, character: 29 }
          },
          relativeRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 17 }
          }
        },
        range: {
          start: { line: 0, character: 12 },
          end: { line: 0, character: 29 }
        },
        severity: 2,
        message: "Unknown utility class 'hover:nonexistent'."
      }
    ]
  })

  testInline('invalid-class/jsx-concat-positive', {
    code: '<div className={`nonexistent ${"px-4"}`}>',
    language: 'javascriptreact',
    expected: [
      {
        className: {
          classList: {
            classList: 'nonexistent $',
            range: {
              end: { character: 30, line: 0 },
              start: { character: 17, line: 0 }
            }
          },
          className: 'nonexistent',
          range: {
            end: { character: 28, line: 0 },
            start: { character: 17, line: 0 }
          },
          relativeRange: {
            end: { character: 11, line: 0 },
            start: { character: 0, line: 0 }
          }
        },
        code: 'invalidClass',
        message: "Unknown utility class 'nonexistent'.",
        range: {
          end: { character: 28, line: 0 },
          start: { character: 17, line: 0 }
        },
        severity: 2,
        source: 'tailwindcss'
      }
    ]
  })

  testInline('invalid-class/jsx-template-literal', {
    code: '<div className={`nonexistent ${"px-4"}`}>',
    language: 'javascriptreact',
    expected: [
      {
        className: {
          classList: {
            classList: 'nonexistent $',
            range: {
              end: { character: 30, line: 0 },
              start: { character: 17, line: 0 }
            }
          },
          className: 'nonexistent',
          range: {
            end: { character: 28, line: 0 },
            start: { character: 17, line: 0 }
          },
          relativeRange: {
            end: { character: 11, line: 0 },
            start: { character: 0, line: 0 }
          }
        },
        code: 'invalidClass',
        message: "Unknown utility class 'nonexistent'.",
        range: {
          end: { character: 28, line: 0 },
          start: { character: 17, line: 0 }
        },
        severity: 2,
        source: 'tailwindcss'
      }
    ]
  })

  testInline('invalid-class/css', {
    code: '.test { @apply nonexistent; }',
    language: 'css',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'nonexistent',
          classList: {
            classList: 'nonexistent',
            important: false,
            range: {
              start: { line: 0, character: 15 },
              end: { line: 0, character: 26 }
            }
          },
          range: {
            start: { line: 0, character: 15 },
            end: { line: 0, character: 26 }
          },
          relativeRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 11 }
          }
        },
        range: {
          start: { line: 0, character: 15 },
          end: { line: 0, character: 26 }
        },
        severity: 2,
        message: "Unknown utility class 'nonexistent'."
      }
    ]
  })

  testInline('invalid-class/css-multi-prop', {
    code: '.test { @apply px-4; color: red; @apply nonexistent }',
    language: 'css',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'nonexistent',
          classList: {
            classList: 'nonexistent',
            important: false,
            range: {
              start: { line: 0, character: 40 },
              end: { line: 0, character: 51 }
            }
          },
          range: {
            start: { line: 0, character: 40 },
            end: { line: 0, character: 51 }
          },
          relativeRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 11 }
          }
        },
        range: {
          start: { line: 0, character: 40 },
          end: { line: 0, character: 51 }
        },
        severity: 2,
        message: "Unknown utility class 'nonexistent'."
      }
    ]
  })

  testInline('invalid-class/css-multi-rule', {
    code: '.test { @apply px-4 }\n.test { @apply nonexistent }',
    language: 'css',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'nonexistent',
          classList: {
            classList: 'nonexistent',
            important: false,
            range: {
              start: { line: 1, character: 15 },
              end: { line: 1, character: 26 }
            }
          },
          range: {
            start: { line: 1, character: 15 },
            end: { line: 1, character: 26 }
          },
          relativeRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 11 }
          }
        },
        range: {
          start: { line: 1, character: 15 },
          end: { line: 1, character: 26 }
        },
        severity: 2,
        message: "Unknown utility class 'nonexistent'."
      }
    ]
  })

  testInline('invalid-class/vue-style-lang-sass', {
    code: '<style lang="sass">\n.foo\n  @apply nonexistent\n</style>',
    language: 'vue',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'nonexistent',
          classList: {
            classList: 'nonexistent',
            important: false,
            range: {
              start: { line: 2, character: 9 },
              end: { line: 2, character: 20 }
            }
          },
          range: {
            start: { line: 2, character: 9 },
            end: { line: 2, character: 20 }
          },
          relativeRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 11 }
          }
        },
        range: {
          start: { line: 2, character: 9 },
          end: { line: 2, character: 20 }
        },
        severity: 2,
        message: "Unknown utility class 'nonexistent'."
      }
    ]
  })

  testInline('invalid-class/custom-property-value', {
    code: '<div class="p-[--foo]"></div>',
    expected: []
  })
})

withFixture('v4/basic', (c) => {
  let testInline = createTestInline(c, {
    tailwindCSS: {
      lint: {
        invalidClass: 'warning'
      }
    }
  })

  testInline('invalid-class/simple', {
    code: '<div class="px-4 nonexistent-class"></div>',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'nonexistent-class',
          classList: {
            classList: 'px-4 nonexistent-class',
            range: {
              start: { line: 0, character: 12 },
              end: { line: 0, character: 34 }
            }
          },
          relativeRange: {
            start: { line: 0, character: 5 },
            end: { line: 0, character: 22 }
          },
          range: { start: { line: 0, character: 17 }, end: { line: 0, character: 34 } }
        },
        range: { start: { line: 0, character: 17 }, end: { line: 0, character: 34 } },
        severity: 2,
        message: "Unknown utility class 'nonexistent-class'."
      }
    ]
  })

  testInline('invalid-class/whitespace-negative', {
    code: '<div class="\n              px-4\n            "></div>',
    expected: []
  })

  testInline('invalid-class/variants-positive', {
    code: '<div class="hover:px-4"></div>',
    expected: []
  })

  testInline('invalid-class/variants', {
    code: '<div class="hover:nonexistent"></div>',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'hover:nonexistent',
          classList: {
            classList: 'hover:nonexistent',
            range: {
              start: { line: 0, character: 12 },
              end: { line: 0, character: 29 }
            }
          },
          range: {
            start: { line: 0, character: 12 },
            end: { line: 0, character: 29 }
          },
          relativeRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 17 }
          }
        },
        range: {
          start: { line: 0, character: 12 },
          end: { line: 0, character: 29 }
        },
        severity: 2,
        message: "Unknown utility class 'hover:nonexistent'."
      }
    ]
  })

  testInline('invalid-class/jsx-concat-positive', {
    code: '<div className={`nonexistent ${"px-4"}`}>',
    language: 'javascriptreact',
    expected: [
      {
        className: {
          classList: {
            classList: 'nonexistent $',
            range: {
              end: { character: 30, line: 0 },
              start: { character: 17, line: 0 }
            }
          },
          className: 'nonexistent',
          range: {
            end: { character: 28, line: 0 },
            start: { character: 17, line: 0 }
          },
          relativeRange: {
            end: { character: 11, line: 0 },
            start: { character: 0, line: 0 }
          }
        },
        code: 'invalidClass',
        message: "Unknown utility class 'nonexistent'.",
        range: {
          end: { character: 28, line: 0 },
          start: { character: 17, line: 0 }
        },
        severity: 2,
        source: 'tailwindcss'
      }
    ]
  })

  testInline('invalid-class/jsx-template-literal', {
    code: '<div className={`nonexistent ${"px-4"}`}>',
    language: 'javascriptreact',
    expected: [
      {
        className: {
          classList: {
            classList: 'nonexistent $',
            range: {
              end: { character: 30, line: 0 },
              start: { character: 17, line: 0 }
            }
          },
          className: 'nonexistent',
          range: {
            end: { character: 28, line: 0 },
            start: { character: 17, line: 0 }
          },
          relativeRange: {
            end: { character: 11, line: 0 },
            start: { character: 0, line: 0 }
          }
        },
        code: 'invalidClass',
        message: "Unknown utility class 'nonexistent'.",
        range: {
          end: { character: 28, line: 0 },
          start: { character: 17, line: 0 }
        },
        severity: 2,
        source: 'tailwindcss'
      }
    ]
  })

  testInline('invalid-class/css', {
    code: '.test { @apply nonexistent; }',
    language: 'css',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'nonexistent',
          classList: {
            classList: 'nonexistent',
            important: false,
            range: {
              start: { line: 0, character: 15 },
              end: { line: 0, character: 26 }
            }
          },
          range: {
            start: { line: 0, character: 15 },
            end: { line: 0, character: 26 }
          },
          relativeRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 11 }
          }
        },
        range: {
          start: { line: 0, character: 15 },
          end: { line: 0, character: 26 }
        },
        severity: 2,
        message: "Unknown utility class 'nonexistent'."
      }
    ]
  })

  testInline('invalid-class/css-multi-prop', {
    code: '.test { @apply px-4; color: red; @apply nonexistent }',
    language: 'css',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'nonexistent',
          classList: {
            classList: 'nonexistent',
            important: false,
            range: {
              start: { line: 0, character: 40 },
              end: { line: 0, character: 51 }
            }
          },
          range: {
            start: { line: 0, character: 40 },
            end: { line: 0, character: 51 }
          },
          relativeRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 11 }
          }
        },
        range: {
          start: { line: 0, character: 40 },
          end: { line: 0, character: 51 }
        },
        severity: 2,
        message: "Unknown utility class 'nonexistent'."
      }
    ]
  })

  testInline('invalid-class/css-multi-rule', {
    code: '.test { @apply px-4 }\n.test { @apply nonexistent }',
    language: 'css',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'nonexistent',
          classList: {
            classList: 'nonexistent',
            important: false,
            range: {
              start: { line: 1, character: 15 },
              end: { line: 1, character: 26 }
            }
          },
          range: {
            start: { line: 1, character: 15 },
            end: { line: 1, character: 26 }
          },
          relativeRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 11 }
          }
        },
        range: {
          start: { line: 1, character: 15 },
          end: { line: 1, character: 26 }
        },
        severity: 2,
        message: "Unknown utility class 'nonexistent'."
      }
    ]
  })

  testInline('invalid-class/vue-style-lang-sass', {
    code: '<style lang="sass">\n.foo\n  @apply nonexistent\n</style>',
    language: 'vue',
    expected: [
      {
        code: 'invalidClass',
        source: 'tailwindcss',
        className: {
          className: 'nonexistent',
          classList: {
            classList: 'nonexistent',
            important: false,
            range: {
              start: { line: 2, character: 9 },
              end: { line: 2, character: 20 }
            }
          },
          range: {
            start: { line: 2, character: 9 },
            end: { line: 2, character: 20 }
          },
          relativeRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 11 }
          }
        },
        range: {
          start: { line: 2, character: 9 },
          end: { line: 2, character: 20 }
        },
        severity: 2,
        message: "Unknown utility class 'nonexistent'."
      }
    ]
  })

  testInline('invalid-class/custom-property-value', {
    code: '<div class="p-[--foo]"></div>',
    expected: []
  })
})
