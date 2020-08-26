import { onMessage } from '../notifications'
import { State } from '../util/state'
import {
  findClassListsInDocument,
  getClassNamesInClassList,
  findHelperFunctionsInDocument,
} from '../util/find'
import { getClassNameParts } from '../util/getClassNameAtPosition'
import { getColor, getColorFromValue } from '../util/color'
import { stringToPath } from '../util/stringToPath'
const dlv = require('dlv')

export function registerDocumentColorProvider(state: State) {
  onMessage(
    state.editor.connection,
    'getDocumentColors',
    async ({ document }) => {
      let colors = []
      if (!state.enabled) return { colors }
      let doc = state.editor.documents.get(document)
      if (!doc) return { colors }

      let classLists = findClassListsInDocument(state, doc)
      classLists.forEach((classList) => {
        let classNames = getClassNamesInClassList(classList)
        classNames.forEach((className) => {
          let parts = getClassNameParts(state, className.className)
          if (!parts) return
          let color = getColor(state, parts)
          if (color === null || typeof color === 'string' || color.a === 0) {
            return
          }
          colors.push({ range: className.range, color: color.toRgbString() })
        })
      })

      let helperFns = findHelperFunctionsInDocument(state, doc)
      helperFns.forEach((fn) => {
        let keys = stringToPath(fn.value)
        let base = fn.helper === 'theme' ? ['theme'] : []
        let value = dlv(state.config, [...base, ...keys])
        let color = getColorFromValue(value)
        if (color) {
          colors.push({ range: fn.valueRange, color })
        }
      })

      return { colors }
    }
  )
}
