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
          if (!color) return
          colors.push({ range: className.range, color: color.documentation })
        })
      })

      let helperFns = findHelperFunctionsInDocument(state, doc)
      helperFns.forEach((fn) => {
        let keys = stringToPath(fn.value)
        let base = fn.helper === 'theme' ? ['theme'] : []
        let value = dlv(state.config, [...base, ...keys])
        let color = getColorFromValue(value)
        if (color) {
          // colors.push({
          //   range: {
          //     start: {
          //       line: fn.valueRange.start.line,
          //       character: fn.valueRange.start.character + 1,
          //     },
          //     end: fn.valueRange.end,
          //   },
          //   color,
          // })
          colors.push({ range: fn.valueRange, color })
        }
      })

      return { colors }
    }
  )
}
