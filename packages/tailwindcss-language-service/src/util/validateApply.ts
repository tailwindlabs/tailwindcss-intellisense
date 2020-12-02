import { State } from './state'
import { getClassNameMeta } from './getClassNameMeta'
import { flagEnabled } from './flagEnabled'
import semver from 'semver'

export function validateApply(
  state: State,
  classNameOrParts: string | string[]
): { isApplyable: true } | { isApplyable: false; reason: string } | null {
  const meta = getClassNameMeta(state, classNameOrParts)
  if (!meta) return null

  if (
    semver.gte(state.version, '2.0.0-alpha.1') ||
    flagEnabled(state, 'applyComplexClasses')
  ) {
    return { isApplyable: true }
  }

  const className = Array.isArray(classNameOrParts)
    ? classNameOrParts.join(state.separator)
    : classNameOrParts

  let reason: string

  if (Array.isArray(meta)) {
    reason = `'@apply' cannot be used with '${className}' because it is included in multiple rulesets.`
  } else if (meta.source !== 'utilities') {
    reason = `'@apply' cannot be used with '${className}' because it is not a utility.`
  } else if (meta.context && meta.context.length > 0) {
    if (meta.context.length === 1) {
      reason = `'@apply' cannot be used with '${className}' because it is nested inside of an at-rule ('${meta.context[0]}').`
    } else {
      reason = `'@apply' cannot be used with '${className}' because it is nested inside of at-rules (${meta.context
        .map((c) => `'${c}'`)
        .join(', ')}).`
    }
  } else if (meta.pseudo && meta.pseudo.length > 0) {
    if (meta.pseudo.length === 1) {
      reason = `'@apply' cannot be used with '${className}' because its definition includes a pseudo-selector ('${meta.pseudo[0]}')`
    } else {
      reason = `'@apply' cannot be used with '${className}' because its definition includes pseudo-selectors (${meta.pseudo
        .map((p) => `'${p}'`)
        .join(', ')}).`
    }
  }

  if (reason) {
    return { isApplyable: false, reason }
  }

  return { isApplyable: true }
}
