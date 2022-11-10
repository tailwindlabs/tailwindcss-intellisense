import {
  window as Window,
  workspace as Workspace,
  Range,
  ExtensionContext,
  TextEditorDecorationType,
  commands,
  languages as Languages,
  TextDocument,
  FoldingRange,
  TextEditor,
  ConfigurationTarget,
} from 'vscode'

const TailwindIconPath = 'media/icon.svg'
const FoldClassAttributesConfigId = 'experimental.foldClassAttributes'
const ClassAttributeConfigId = 'classAttributes'

let classRegex: RegExp | undefined

let classAttributeToDecType: Record<string, TextEditorDecorationType> = {}
const unFoldedDecType = Window.createTextEditorDecorationType({})
let multilineFoldDecType: TextEditorDecorationType | undefined

const multilineFoldRanges = new Set<Range>()

export function initClassFoldingDecorator(context: ExtensionContext) {
  resetState()

  const classAttributes = getConfigValue(ClassAttributeConfigId)
  setClassAttributeToDecType(classAttributes, context)
  setClassRegex(classAttributes)
}

function resetState() {
  Object.values(classAttributeToDecType).forEach((decType) => decType.dispose())
  multilineFoldDecType?.dispose()
  multilineFoldRanges.forEach((r) => foldingCommand('unfold', r))
}

function setClassAttributeToDecType(classAttributes: string[], context: ExtensionContext) {
  const fontSize = Workspace.getConfiguration('editor').fontSize
  const margin = 2

  classAttributes.forEach((classAttribute) => {
    classAttributeToDecType[classAttribute] = Window.createTextEditorDecorationType({
      before: {
        contentText: classAttribute,
        margin: `0 ${fontSize + margin}px 0 0`,
      },
      after: {
        height: `${fontSize}px`,
        width: `${fontSize}px`,
        contentIconPath: context.asAbsolutePath(TailwindIconPath),
        margin: `0 0 0 ${-fontSize}px`,
      },
      textDecoration: 'none; display:none;',
    })
  })

  multilineFoldDecType = Window.createTextEditorDecorationType({
    after: {
      height: `${fontSize}px`,
      width: `${fontSize}px`,
      contentIconPath: context.asAbsolutePath(TailwindIconPath),
      margin: `0 0 0 ${margin}px`,
    },
    textDecoration: 'none; display:none;',
  })
}

function setClassRegex(classAttributes: string[]) {
  const beforeEqualSign = '(' + classAttributes.join('|') + ')'
  const afterEqualSign = '(({(`|))|([\'"`]))((.|\n)*?)(\\2|(\\4)})'
  classRegex = new RegExp(beforeEqualSign + '=' + afterEqualSign, 'g')
}

let timeout: NodeJS.Timer | undefined = undefined
export function triggerUpdateDecorations(throttle = false) {
  if (timeout) {
    clearTimeout(timeout)
    timeout = undefined
  }
  if (throttle) {
    timeout = setTimeout(updateDecorations, 100)
  } else {
    updateDecorations()
  }
}

function updateDecorations() {
  const foldClassAttributes = getConfigValue(FoldClassAttributesConfigId)
  let activeEditor = Window.activeTextEditor
  if (!foldClassAttributes || !activeEditor || !classRegex) return

  const matchesAndRanges = findMatchesAndRanges(activeEditor)

  const unfoldRanges: Range[] = []
  updateInlineFolding(activeEditor, matchesAndRanges, unfoldRanges)
  updateMultilineFolding(activeEditor, matchesAndRanges, unfoldRanges)

  activeEditor.setDecorations(unFoldedDecType, unfoldRanges)
}

function findMatchesAndRanges(activeEditor: TextEditor) {
  const matchesAndRanges: [match: RegExpExecArray, range: Range][] = []

  const text = activeEditor.document.getText()
  let match
  while ((match = classRegex.exec(text))) {
    if (match && !match[0]) continue
    const startPosition = activeEditor.document.positionAt(match.index)
    const endPosition = activeEditor.document.positionAt(match.index + match[0].length)
    const range = new Range(startPosition, endPosition)

    matchesAndRanges.push([match, range])
  }
  return matchesAndRanges
}

function updateInlineFolding(
  activeEditor: TextEditor,
  matchesAndRanges: [match: RegExpExecArray, range: Range][],
  unfoldRanges: Range[]
) {
  const foldDecTypeToRanges = new Map<TextEditorDecorationType, Range[]>()
  Object.values(classAttributeToDecType).forEach((decType) => foldDecTypeToRanges.set(decType, []))

  for (let [match, range] of matchesAndRanges) {
    if (!range.isSingleLine) continue

    //Unfold if range is within user selection, accounting for both single or multiple cursors
    if (activeEditor.selections.some((s) => range.intersection(s))) {
      unfoldRanges.push(range)
    } else {
      const classAttribute = match[1]
      foldDecTypeToRanges.get(classAttributeToDecType[classAttribute]).push(range)
    }
  }

  foldDecTypeToRanges.forEach((ranges, decType) => activeEditor.setDecorations(decType, ranges))
}

function updateMultilineFolding(
  activeEditor: TextEditor,
  matchesAndRanges: [match: RegExpExecArray, range: Range][],
  unfoldRanges: Range[]
) {
  const foldRanges = []
  for (let [match, range] of matchesAndRanges) {
    if (range.isSingleLine) continue

    const classAttribute = match[1]
    const afterClassAttributePosition = range.start.translate(0, classAttribute.length)
    const endOfLinePosition = activeEditor.document.lineAt(afterClassAttributePosition).range.end
    const firstLineRange = new Range(afterClassAttributePosition, endOfLinePosition)

    if (
      activeEditor.selections.some((s) => s.start.line === range.end.line) ||
      activeEditor.selections.some((s) => s.start.line === range.start.line) ||
      activeEditor.selections.some((s) => range.intersection(s))
    ) {
      unfoldRanges.push(firstLineRange)
      foldingCommand('unfold', range)
    } else {
      foldRanges.push(firstLineRange)
      foldingCommand('fold', range)
      multilineFoldRanges.add(range)
    }
  }

  activeEditor.setDecorations(multilineFoldDecType, foldRanges)
}

export function registerFoldingRangeProvider() {
  return Languages.registerFoldingRangeProvider(
    { language: '*', scheme: 'file' },
    {
      provideFoldingRanges(document: TextDocument) {
        const ranges = []

        let match
        while ((match = classRegex.exec(document.getText()))) {
          if (match && !match[0]) continue

          const startPosition = document.positionAt(match.index)
          const endPosition = document.positionAt(match.index + match[0].length)

          if (startPosition.line !== endPosition.line) {
            ranges.push(new FoldingRange(startPosition.line, endPosition.line))
          }
        }
        return ranges
      },
    }
  )
}

export function toggleFoldClassAttributes() {
  const foldClassAttributes = getConfigValue(FoldClassAttributesConfigId)
  return Workspace.getConfiguration('tailwindCSS').update(
    FoldClassAttributesConfigId,
    !foldClassAttributes,
    ConfigurationTarget.Global
  )
}

function getConfigValue(configId: string) {
  return Workspace.getConfiguration('tailwindCSS').get<string[]>(configId)
}

function foldingCommand(command: 'fold' | 'unfold', range: Range) {
  return commands.executeCommand(`editor.${command}`, {
    level: 1,
    direction: 'down',
    selectionLines: [range.end.line],
  })
}
