import { expect, test } from 'vitest'
import { DiagnosticTag } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { createState, getDefaultTailwindSettings } from '../util/state'
import { getDeprecatedAtRuleDiagnostics } from './getDeprecatedAtRuleDiagnostics'

test('adds deprecated tags when supported by the client', () => {
  let document = TextDocument.create('file:///app.css', 'css', 0, '@variant hocus (&:hover);')
  let settings = getDefaultTailwindSettings()
  let state = createState({
    v4: true,
    editor: {
      capabilities: {
        configuration: true,
        diagnosticRelatedInformation: true,
        diagnosticTagSupport: true,
        itemDefaults: [],
      },
    },
  })

  expect(getDeprecatedAtRuleDiagnostics(state, document, settings)).toMatchObject([
    {
      code: 'deprecatedAtRule',
      tags: [DiagnosticTag.Deprecated],
    },
  ])
})

test('omits deprecated tags when unsupported by the client', () => {
  let document = TextDocument.create('file:///app.css', 'css', 0, '@variant hocus (&:hover);')
  let settings = getDefaultTailwindSettings()
  let state = createState({
    v4: true,
    editor: {
      capabilities: {
        configuration: true,
        diagnosticRelatedInformation: true,
        diagnosticTagSupport: false,
        itemDefaults: [],
      },
    },
  })

  expect(getDeprecatedAtRuleDiagnostics(state, document, settings)[0]).not.toHaveProperty('tags')
})
