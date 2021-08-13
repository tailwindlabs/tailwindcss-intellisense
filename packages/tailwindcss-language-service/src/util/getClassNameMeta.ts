import { State, ClassNameMeta } from './state'
import { getClassNameParts } from './getClassNameAtPosition'
const dlv = require('dlv')

export function getClassNameMeta(
  state: State,
  classNameOrParts: string | string[]
): ClassNameMeta | ClassNameMeta[] {
  const parts = Array.isArray(classNameOrParts)
    ? classNameOrParts
    : getClassNameParts(state, classNameOrParts)
  if (!parts) return null
  const info = dlv(state.classNames.classNames, [...parts, '__info'])

  if (Array.isArray(info)) {
    return info.map((i) => ({
      source: i.__source,
      pseudo: i.__pseudo,
      scope: i.__scope,
      context: i.__context,
    }))
  }

  return {
    source: info.__source,
    pseudo: info.__pseudo,
    scope: info.__scope,
    context: info.__context,
  }
}
