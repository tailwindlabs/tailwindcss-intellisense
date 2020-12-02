import moo from 'moo'
import { lazy } from './lazy'

const classAttributeStates: () => { [x: string]: moo.Rules } = () => ({
  doubleClassList: {
    lbrace: { match: new RegExp('(?<!\\\\)\\{'), push: 'interpBrace' },
    rbrace: { match: new RegExp('(?<!\\\\)\\}'), pop: 1 },
    end: { match: new RegExp('(?<!\\\\)"'), pop: 1 },
    classlist: { match: new RegExp('[\\s\\S]'), lineBreaks: true },
  },
  singleClassList: {
    lbrace: { match: new RegExp('(?<!\\\\)\\{'), push: 'interpBrace' },
    rbrace: { match: new RegExp('(?<!\\\\)\\}'), pop: 1 },
    end: { match: new RegExp("(?<!\\\\)'"), pop: 1 },
    classlist: { match: new RegExp('[\\s\\S]'), lineBreaks: true },
  },
  tickClassList: {
    lbrace: { match: new RegExp('(?<=(?<!\\\\)\\$)\\{'), push: 'interpBrace' },
    rbrace: { match: new RegExp('(?<!\\\\)\\}'), pop: 1 },
    end: { match: new RegExp('(?<!\\\\)`'), pop: 1 },
    classlist: { match: new RegExp('[\\s\\S]'), lineBreaks: true },
  },
  interpBrace: {
    startSingle: { match: new RegExp("(?<!\\\\)'"), push: 'singleClassList' },
    startDouble: { match: new RegExp('(?<!\\\\)"'), push: 'doubleClassList' },
    startTick: { match: new RegExp('(?<!\\\\)`'), push: 'tickClassList' },
    lbrace: { match: new RegExp('(?<!\\\\)\\{'), push: 'interpBrace' },
    rbrace: { match: new RegExp('(?<!\\\\)\\}'), pop: 1 },
    text: { match: new RegExp('[\\s\\S]'), lineBreaks: true },
  },
  interpSingle: {
    startDouble: { match: new RegExp('(?<!\\\\)"'), push: 'doubleClassList' },
    startTick: { match: new RegExp('(?<!\\\\)`'), push: 'tickClassList' },
    single: { match: new RegExp("(?<!\\\\)'"), pop: 1 },
    text: { match: new RegExp('[\\s\\S]'), lineBreaks: true },
  },
  interpDouble: {
    startSingle: { match: new RegExp("(?<!\\\\)'"), push: 'singleClassList' },
    startTick: { match: new RegExp('(?<!\\\\)`'), push: 'tickClassList' },
    double: { match: new RegExp('(?<!\\\\)"'), pop: 1 },
    text: { match: new RegExp('[\\s\\S]'), lineBreaks: true },
  },
})

const simpleClassAttributeStates: { [x: string]: moo.Rules } = {
  main: {
    start: { match: '"', push: 'doubleClassList' },
  },
  doubleClassList: {
    end: { match: '"', pop: 1 },
    classlist: { match: /[\s\S]/, lineBreaks: true },
  },
}

export const getClassAttributeLexer = lazy(() => {
  let supportsNegativeLookbehind = true
  try {
    new RegExp('(?<!)')
  } catch (_) {
    supportsNegativeLookbehind = false
  }

  if (supportsNegativeLookbehind) {
    return moo.states({
      main: {
        start1: { match: '"', push: 'doubleClassList' },
        start2: { match: "'", push: 'singleClassList' },
        start3: { match: '{', push: 'interpBrace' },
      },
      ...classAttributeStates(),
    })
  }

  return moo.states(simpleClassAttributeStates)
})

export const getComputedClassAttributeLexer = lazy(() => {
  let supportsNegativeLookbehind = true
  try {
    new RegExp('(?<!)')
  } catch (_) {
    supportsNegativeLookbehind = false
  }

  if (supportsNegativeLookbehind) {
    return moo.states({
      main: {
        lbrace: { match: '{', push: 'interpBrace' },
        single: { match: "'", push: 'interpSingle' },
        double: { match: '"', push: 'interpDouble' },
      },
      ...classAttributeStates(),
    })
  }

  return moo.states(simpleClassAttributeStates)
})
