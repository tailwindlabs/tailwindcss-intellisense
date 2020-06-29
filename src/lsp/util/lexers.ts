import moo from 'moo'
import { lazy } from './lazy'

const classAttributeStates: { [x: string]: moo.Rules } = {
  doubleClassList: {
    lbrace: { match: /(?<!\\)\{/, push: 'interpBrace' },
    rbrace: { match: /(?<!\\)\}/, pop: 1 },
    end: { match: /(?<!\\)"/, pop: 1 },
    classlist: { match: /[\s\S]/, lineBreaks: true },
  },
  singleClassList: {
    lbrace: { match: /(?<!\\)\{/, push: 'interpBrace' },
    rbrace: { match: /(?<!\\)\}/, pop: 1 },
    end: { match: /(?<!\\)'/, pop: 1 },
    classlist: { match: /[\s\S]/, lineBreaks: true },
  },
  tickClassList: {
    lbrace: { match: /(?<=(?<!\\)\$)\{/, push: 'interpBrace' },
    rbrace: { match: /(?<!\\)\}/, pop: 1 },
    end: { match: /(?<!\\)`/, pop: 1 },
    classlist: { match: /[\s\S]/, lineBreaks: true },
  },
  interpBrace: {
    startSingle: { match: /(?<!\\)'/, push: 'singleClassList' },
    startDouble: { match: /(?<!\\)"/, push: 'doubleClassList' },
    startTick: { match: /(?<!\\)`/, push: 'tickClassList' },
    lbrace: { match: /(?<!\\)\{/, push: 'interpBrace' },
    rbrace: { match: /(?<!\\)\}/, pop: 1 },
    text: { match: /[\s\S]/, lineBreaks: true },
  },
  interpSingle: {
    startDouble: { match: /(?<!\\)"/, push: 'doubleClassList' },
    startTick: { match: /(?<!\\)`/, push: 'tickClassList' },
    single: { match: /(?<!\\)'/, pop: 1 },
    text: { match: /[\s\S]/, lineBreaks: true },
  },
  interpDouble: {
    startSingle: { match: /(?<!\\)'/, push: 'singleClassList' },
    startTick: { match: /(?<!\\)`/, push: 'tickClassList' },
    double: { match: /(?<!\\)"/, pop: 1 },
    text: { match: /[\s\S]/, lineBreaks: true },
  },
}

export const getClassAttributeLexer = lazy(() =>
  moo.states({
    main: {
      start1: { match: '"', push: 'doubleClassList' },
      start2: { match: "'", push: 'singleClassList' },
      start3: { match: '{', push: 'interpBrace' },
    },
    ...classAttributeStates,
  })
)

export const getComputedClassAttributeLexer = lazy(() =>
  moo.states({
    main: {
      lbrace: { match: '{', push: 'interpBrace' },
      single: { match: "'", push: 'interpSingle' },
      double: { match: '"', push: 'interpDouble' },
    },
    ...classAttributeStates,
  })
)
