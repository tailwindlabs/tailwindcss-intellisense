import * as postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { CompletionItemKind } from 'vscode-languageserver'
import * as fs from 'node:fs/promises'
import type { State } from './state'

interface ScannedClass {
  className: string
  source: string
  declarations: Record<string, string>
}

/**
 * Extract custom CSS classes from CSS content
 */
export function extractCustomClassesFromCss(css: string, source: string): ScannedClass[] {
  const classes: ScannedClass[] = []

  try {
    const root = postcss.parse(css)

    root.walkRules((rule) => {
      // Skip Tailwind utility classes (they typically have many hyphens and are generated)
      // Focus on custom classes that are more likely to be user-defined
      if (isLikelyCustomClass(rule.selector)) {
        const classNames = extractClassNamesFromSelector(rule.selector)

        for (const className of classNames) {
          const declarations: Record<string, string> = {}

          rule.walkDecls((decl) => {
            declarations[decl.prop] = decl.value
          })

          classes.push({
            className,
            source,
            declarations,
          })
        }
      }
    })
  } catch (error) {
    console.error(`Error parsing CSS from ${source}:`, error)
  }

  return classes
}

/**
 * Check if a selector is likely to be a custom class (not a Tailwind utility)
 */
function isLikelyCustomClass(selector: string): boolean {
  // Skip if it's not a class selector
  if (!selector.includes('.')) return false

  // Skip if it's a Tailwind utility class (many hyphens, typically)
  if (selector.includes('--')) return false

  // Skip if it looks like a Tailwind utility (many hyphens in sequence)
  if (/([a-z]+-){3,}/.test(selector)) return false

  // Skip pseudo-selectors and complex selectors for now
  if (selector.includes(':')) return false
  if (selector.includes('[')) return false
  if (selector.includes('>')) return false
  if (selector.includes('+')) return false
  if (selector.includes('~')) return false

  // Skip if it has a pattern like color-number (e.g., blue-500, red-500)
  const className = selector.replace(/^\./, '')
  if (/^[a-z]+-\d+$/.test(className)) return false

  // Skip if it has multiple hyphens and ends with a number (common Tailwind pattern)
  // But allow patterns like typography-h3, button-primary, etc.
  if (/^[a-z-]+\d+$/.test(className) && !/^[a-z]+-[a-z]+\d+$/.test(className)) return false

  // Skip common Tailwind utility patterns
  const tailwindPatterns = [
    /^text-[a-z]+-\d+$/, // text-blue-500
    /^bg-[a-z]+-\d+$/, // bg-red-500
    /^p-\d+$/, // p-4
    /^m-\d+$/, // m-4
    /^w-\d+$/, // w-4
    /^h-\d+$/, // h-4
    /^flex-[a-z]+$/, // flex-row
    /^grid-[a-z]+$/, // grid-cols-2
    /^border-[a-z]+-\d+$/, // border-gray-200
    /^rounded-[a-z]+$/, // rounded-lg
    /^shadow-[a-z]+$/, // shadow-lg
  ]

  for (const pattern of tailwindPatterns) {
    if (pattern.test(className)) return false
  }

  return true
}

/**
 * Extract class names from a CSS selector
 */
function extractClassNamesFromSelector(selector: string): string[] {
  const classNames: string[] = []

  try {
    const { nodes: subSelectors } = selectorParser().astSync(selector)

    for (const subSelector of subSelectors) {
      if (subSelector.type !== 'selector') continue

      for (const node of subSelector.nodes) {
        if (node.type === 'class') {
          classNames.push(node.value.trim())
        }
      }
    }
  } catch (error) {
    console.error(`Error parsing selector "${selector}":`, error)
  }

  return classNames
}

/**
 * Scan CSS files for custom classes and add them to the state
 */
export async function scanCssFilesForCustomClasses(
  state: State,
  cssFiles: string[],
): Promise<void> {
  // This works for both v3 and v4 projects

  const customClasses: ScannedClass[] = []

  for (const cssFile of cssFiles) {
    try {
      const content = await fs.readFile(cssFile, 'utf-8')
      const classes = extractCustomClassesFromCss(content, cssFile)
      customClasses.push(...classes)
    } catch (error) {
      console.error(`Error reading CSS file ${cssFile}:`, error)
    }
  }

  // Add custom classes to the state
  if (customClasses.length > 0) {
    // Create completion items for custom classes
    const customClassItems = customClasses.map((cls, index) => ({
      label: cls.className,
      kind: CompletionItemKind.Constant,
      detail: `Custom CSS class from ${cls.source}`,
      sortText: `custom-${index.toString().padStart(6, '0')}`,
      data: {
        _type: 'custom-css-class',
        source: cls.source,
        declarations: cls.declarations,
      },
    }))

    // Store custom classes in state for later use
    if (!state.customCssClasses) {
      state.customCssClasses = []
    }
    state.customCssClasses.push(...customClassItems)
  }
}
