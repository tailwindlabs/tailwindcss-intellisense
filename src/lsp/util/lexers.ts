import moo from 'moo'
import { lazy } from './lazy'

const classAttributeStates: { [x: string]: moo.Rules } = {
  doubleClassList: {
    lbrace: { match: /(?<!\\)\{/, push: 'interp' },
    rbrace: { match: /(?<!\\)\}/, pop: 1 },
    end: { match: /(?<!\\)"/, pop: 1 },
    classlist: { match: /[\s\S]/, lineBreaks: true },
  },
  singleClassList: {
    lbrace: { match: /(?<!\\)\{/, push: 'interp' },
    rbrace: { match: /(?<!\\)\}/, pop: 1 },
    end: { match: /(?<!\\)'/, pop: 1 },
    classlist: { match: /[\s\S]/, lineBreaks: true },
  },
  tickClassList: {
    lbrace: { match: /(?<=(?<!\\)\$)\{/, push: 'interp' },
    rbrace: { match: /(?<!\\)\}/, pop: 1 },
    end: { match: /(?<!\\)`/, pop: 1 },
    classlist: { match: /[\s\S]/, lineBreaks: true },
  },
  interp: {
    startSingle: { match: /(?<!\\)'/, push: 'singleClassList' },
    startDouble: { match: /(?<!\\)"/, push: 'doubleClassList' },
    startTick: { match: /(?<!\\)`/, push: 'tickClassList' },
    lbrace: { match: /(?<!\\)\{/, push: 'interp' },
    rbrace: { match: /(?<!\\)\}/, pop: 1 },
    text: { match: /[\s\S]/, lineBreaks: true },
  },
}

export const getClassAttributeLexer = lazy(() =>
  moo.states({
    main: {
      start1: { match: '"', push: 'doubleClassList' },
      start2: { match: "'", push: 'singleClassList' },
      start3: { match: '{', push: 'interp' },
    },
    ...classAttributeStates,
  })
)

export const getComputedClassAttributeLexer = lazy(() =>
  moo.states({
    main: {
      quote: { match: /['"{]/, push: 'interp' },
    },
    // TODO: really this should use a different interp definition that is
    // terminated correctly based on the initial quote type
    ...classAttributeStates,
  })
)
