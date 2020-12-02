import { State } from './state'
import { getClassNameParts } from './getClassNameAtPosition'
import removeMeta from './removeMeta'
const dlv = require('dlv')

export function getClassNameDecls(
  state: State,
  className: string
): Record<string, string> | Record<string, string>[] | null {
  const parts = getClassNameParts(state, className)
  if (!parts) return null

  const info = dlv(state.classNames.classNames, [...parts, '__info'])

  if (Array.isArray(info)) {
    return info.map(removeMeta)
  }

  return removeMeta(info)
}
