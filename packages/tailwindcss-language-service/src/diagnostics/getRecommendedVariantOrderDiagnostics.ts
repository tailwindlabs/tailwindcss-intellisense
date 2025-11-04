import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State, Settings } from '../util/state'
import { type RecommendedVariantOrderDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import * as jit from '../util/jit'
import { getVariantsFromClassName } from '../util/getVariantsFromClassName'
import { equalExact } from '../util/array'
import * as semver from '../util/semver'

export async function getRecommendedVariantOrderDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): Promise<RecommendedVariantOrderDiagnostic[]> {
  if (state.v4) return []
  if (!state.jit) return []

  if (semver.gte(state.version, '2.99.0')) return []

  let severity = settings.tailwindCSS.lint.recommendedVariantOrder
  if (severity === 'ignore') return []

  let diagnostics: RecommendedVariantOrderDiagnostic[] = []
  const classLists = await findClassListsInDocument(state, document)

  classLists.forEach((classList) => {
    const classNames = getClassNamesInClassList(classList, state.blocklist)
    classNames.forEach((className) => {
      let { rules } = jit.generateRules(state, [className.className])
      if (rules.length === 0) {
        return
      }

      let order = state.jitContext.variantOrder ?? state.jitContext.offsets.variantOffsets
      let { variants, offset } = getVariantsFromClassName(state, className.className)
      let sortedVariants = [...variants].sort((a, b) => jit.bigSign(order.get(b) - order.get(a)))

      if (!equalExact(variants, sortedVariants)) {
        diagnostics.push({
          code: DiagnosticKind.RecommendedVariantOrder,
          source: 'tailwindcss',
          suggestions: [
            [...sortedVariants, className.className.substr(offset)].join(state.separator),
          ],
          range: className.range,
          severity:
            severity === 'error'
              ? 1 /* DiagnosticSeverity.Error */
              : 2 /* DiagnosticSeverity.Warning */,
          message:
            'Variants are not in the recommended order, which may cause unexpected CSS output.',
        })
      }
    })
  })

  return diagnostics
}
