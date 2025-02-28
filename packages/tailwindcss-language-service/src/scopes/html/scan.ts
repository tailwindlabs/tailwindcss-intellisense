import { ScopeClassAttribute, ScopeComment, ScopeContext } from '../scope'
import { createHtmlStream, StreamOptions } from './stream'

function newContext(start: number): ScopeContext {
  return {
    kind: 'context',
    source: {
      scope: [start, start],
    },
    meta: {
      syntax: 'html',
      lang: 'html',
    },
    children: [],
  }
}

function newComment(start: number): ScopeComment {
  return {
    kind: 'comment',
    source: {
      scope: [start, start],
    },
    children: [],
  }
}

function newClassAttr(start: number, end: number): ScopeClassAttribute {
  return {
    kind: 'class.attr',
    meta: {
      static: true,
    },
    source: {
      scope: [start, end],
    },
    children: [],
  }
}

const enum State {
  Idle,
  InComment,
  WaitForTagOpen,
  WaitForTagClose,
}

interface ScanOptions extends StreamOptions {
  /** A list of attributes which will get `class.attr` scopes */
  classAttributes: string[]
}

export function scanHtml({ input, offset, classAttributes }: ScanOptions): ScopeContext {
  // Compile a regex to match class attributes in the form of:
  // - class
  // - [class]
  // - :class
  // - :[class]
  let patternAttrs = classAttributes.flatMap((x) => [x, `\\[${x}\\]`]).flatMap((x) => [x, `:${x}`])
  let isClassAttr = new RegExp(`^(${patternAttrs.join('|')})$`, 'i')

  let root = newContext(0)
  root.source.scope[1] = input.length

  let state = State.Idle
  let context: ScopeContext = newContext(0)
  let comment: ScopeComment = newComment(0)
  let currentTag = ''
  let currentAttr = ''

  for (let event of createHtmlStream({ input, offset })) {
    // Element attributes
    if (event.kind === 'attr-name') {
      currentAttr = input.slice(event.span[0], event.span[1])
    }

    // Attribute values
    else if (event.kind === 'attr-value' || event.kind === 'attr-expr') {
      let value = input.slice(event.span[0], event.span[1])

      if (currentAttr === 'lang' || currentAttr === 'type') {
        context.meta.lang = value
        continue
      }

      if (classAttributes.length && isClassAttr.test(currentAttr)) {
        let scope = newClassAttr(event.span[0], event.span[1])
        if (event.kind === 'attr-expr') {
          scope.meta.static = false
        } else if (currentAttr[0] === ':') {
          scope.meta.static = false
        } else if (currentAttr[0] === '[' && currentAttr[currentAttr.length - 1] === ']') {
          scope.meta.static = false
        }

        root.children.push(scope)
      }
    }

    // Comments
    else if (event.kind === 'comment-start') {
      comment = newComment(event.span[0])
      state = State.InComment
    } else if (event.kind === 'comment-end') {
      if (state === State.InComment) {
        comment.source.scope[1] = event.span[1]
        root.children.push(comment)
        state = State.Idle
      }
    }

    // Elements
    else if (event.kind === 'element-start') {
      let tag = input.slice(event.span[0], event.span[1])
      if (tag === '<script') {
        currentTag = tag
        context = newContext(event.span[0])
        context.meta.lang = 'js'
        context.meta.syntax = 'js'
        state = State.WaitForTagOpen
      } else if (tag === '<style') {
        currentTag = tag
        context = newContext(event.span[0])
        context.meta.lang = 'css'
        context.meta.syntax = 'css'
        state = State.WaitForTagOpen
      } else if (tag === '</script') {
        if (currentTag !== '<script') continue
        context.source.scope[1] = event.span[0]
        root.children.push(context)
        context = root
        state = State.Idle
      } else if (tag === '</style') {
        if (currentTag !== '<style') continue
        context.source.scope[1] = event.span[0]
        root.children.push(context)
        context = root
        state = State.Idle
      }
    } else if (event.kind === 'element-end') {
      if (state === State.WaitForTagOpen) {
        context.source.scope[0] = event.span[1]
        state = State.Idle
      }
    }
  }

  return root
}
