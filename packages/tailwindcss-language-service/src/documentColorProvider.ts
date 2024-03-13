import type { State } from './util/state'
import {
  findClassListsInDocument,
  getClassNamesInClassList,
  findHelperFunctionsInDocument,
} from './util/find'
import { getColor, getColorFromValue, culoriColorToVscodeColor } from './util/color'
import { stringToPath } from './util/stringToPath'
import type { ColorInformation } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import dlv from 'dlv'
import { dedupeByRange } from './util/array'

export async function getDocumentColors(
  state: State,
  document: TextDocument,
): Promise<ColorInformation[]> {
  let colors: ColorInformation[] = []
  if (!state.enabled) return colors

  let settings = await state.editor.getConfiguration(document.uri)
  if (settings.tailwindCSS.colorDecorators === false) return colors

  let classLists = await findClassListsInDocument(state, document)
  classLists.forEach((classList) => {
    let classNames = getClassNamesInClassList(classList, state.blocklist)
    classNames.forEach((className) => {
      let color = getColor(state, className.className)
      if (color === null || typeof color === 'string' || (color.alpha ?? 1) === 0) {
        return
      }
      colors.push({
        range: className.range,
        color: culoriColorToVscodeColor(color),
      })
    })
  })

  let helperFns = findHelperFunctionsInDocument(state, document)
  helperFns.forEach((fn) => {
    let keys = stringToPath(fn.path)
    let base = fn.helper === 'theme' ? ['theme'] : []
    let value = dlv(state.config, [...base, ...keys])
    let color = getColorFromValue(value)
    if (color && typeof color !== 'string' && (color.alpha ?? 1) !== 0) {
      colors.push({ range: fn.ranges.path, color: culoriColorToVscodeColor(color) })
    }
  })

  return dedupeByRange(colors)
}
