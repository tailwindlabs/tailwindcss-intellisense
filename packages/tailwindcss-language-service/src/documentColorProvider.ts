import { State } from './util/state'
import {
  findClassListsInDocument,
  getClassNamesInClassList,
  findHelperFunctionsInDocument,
} from './util/find'
import { getColor, getColorFromValue, tinyColorToVscodeColor } from './util/color'
import { stringToPath } from './util/stringToPath'
import type { TextDocument, ColorInformation } from 'vscode-languageserver'
import { TinyColor } from '@ctrl/tinycolor'
import dlv from 'dlv'

export async function getDocumentColors(
  state: State,
  document: TextDocument
): Promise<ColorInformation[]> {
  let colors: ColorInformation[] = []
  if (!state.enabled) return colors

  let settings = await state.editor.getConfiguration(document.uri)
  if (settings.tailwindCSS.colorDecorators === false) return colors

  let classLists = await findClassListsInDocument(state, document)
  classLists.forEach((classList) => {
    let classNames = getClassNamesInClassList(classList)
    classNames.forEach((className) => {
      let color = getColor(state, className.className)
      if (color === null || typeof color === 'string' || color.a === 0) {
        return
      }
      colors.push({
        range: className.range,
        color: tinyColorToVscodeColor(color),
      })
    })
  })

  let helperFns = findHelperFunctionsInDocument(state, document)
  helperFns.forEach((fn) => {
    let keys = stringToPath(fn.value)
    let base = fn.helper === 'theme' ? ['theme'] : []
    let value = dlv(state.config, [...base, ...keys])
    let color = getColorFromValue(value)
    if (color instanceof TinyColor && color.a !== 0) {
      colors.push({ range: fn.valueRange, color: tinyColorToVscodeColor(color) })
    }
  })

  return colors
}
