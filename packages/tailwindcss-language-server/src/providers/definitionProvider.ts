import { State, DocumentClassName } from '../util/state'
import {
  TextDocumentPositionParams,
  DefinitionLink,
} from 'vscode-languageserver'
import { isHtmlContext } from '../util/html'
import { isJsContext } from '../util/js'
import {
  getClassNameAtPosition,
  getClassNameParts,
} from '../util/getClassNameAtPosition'
import getConfigLocation from '../util/getConfigLocation'

export function provideDefinition(
  state: State,
  { textDocument, position }: TextDocumentPositionParams
): Promise<DefinitionLink[]> {
  let doc = state.editor.documents.get(textDocument.uri)

  if (!isHtmlContext(doc, position) && !isJsContext(doc, position)) return null

  let hovered = getClassNameAtPosition(doc, position)
  if (!hovered) return null

  return classNameToDefinition(state, hovered)
}

async function classNameToDefinition(
  state: State,
  { className, range }: DocumentClassName
): Promise<DefinitionLink[]> {
  const parts = getClassNameParts(state, className)
  if (!parts) return null

  const configKey = state.utilityConfigMap[parts[parts.length - 1]]
  if (!configKey) return null

  const location = await getConfigLocation(state, configKey.split('.'))
  if (!location) return null

  return [
    {
      originSelectionRange: range,
      targetUri: location.file,
      // TODO: figure out why this doesn't work properly
      targetRange: location.range,
      targetSelectionRange: location.range
    },
  ]
}
