import type { ColorInformation } from 'vscode-languageserver'
import type { Document } from './documents/document'
import { getColor, getColorFromValue, culoriColorToVscodeColor } from './util/color'
import { stringToPath } from './util/stringToPath'
import dlv from 'dlv'
import { dedupeByRange } from './util/array'

export function getDocumentColors(doc: Document): ColorInformation[] {
  let colors: ColorInformation[] = []

  for (let className of doc.classNames()) {
    let color = getColor(doc.state, className.className)
    if (!color) continue
    if (typeof color === 'string') continue
    if ((color.alpha ?? 1) === 0) continue

    colors.push({
      range: className.range,
      color: culoriColorToVscodeColor(color),
    })
  }

  for (let fn of doc.helperFns()) {
    let keys = stringToPath(fn.path)
    let base = fn.helper === 'theme' ? ['theme'] : []
    let value = dlv(doc.state.config, [...base, ...keys])

    let color = getColorFromValue(value)
    if (!color) continue
    if (typeof color === 'string') continue
    if ((color.alpha ?? 1) === 0) continue

    colors.push({
      range: fn.ranges.path,
      color: culoriColorToVscodeColor(color),
    })
  }

  return dedupeByRange(colors)
}
