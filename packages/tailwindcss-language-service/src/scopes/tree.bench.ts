import { run, bench } from 'mitata'

import { ScopeTree } from './tree'
import { Span } from '../util/state'
import { AnyScope, ScopeContext } from './scope'

function createScopes(lists: number, classes: number) {
  let classNames = ['underline', 'flex', 'bg-red-500', 'text-white', 'p-2']

  let contextSpan: Span = [0, 0]
  let context: ScopeContext = {
    kind: 'context',
    children: [],
    meta: {
      syntax: 'html',
      lang: 'html',
    },
    source: { scope: contextSpan },
  }

  let offset = 0

  // Create a dummy set of scopes representing a HTML file like this:
  // <div class="bg-blue-500 text-white"></div>
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ context.html
  //             ^^^^^^^^^^^^^^^^^^^^^^         class.list
  //             ^^^^^^^^^^^ ^^^^^^^^^^         class.name
  for (let i = 0; i < lists; ++i) {
    // <div class="|
    //             ^
    offset += 12

    let list: AnyScope = {
      kind: 'class.list',
      children: [],
      source: { scope: [offset, offset] },
    }

    let attr: AnyScope = {
      kind: 'class.attr',
      meta: { static: true },
      children: [list],
      source: { scope: [offset, offset] },
    }

    context.children.push(attr)

    for (let j = 0; j < classes; ++j) {
      let randomClass = classNames[Math.floor(Math.random() * classNames.length)]

      list.children.push({
        kind: 'class.name',
        children: [],
        source: { scope: [offset, offset + randomClass.length] },
      })

      // <div class="bg-blue-500 text-white"></div>
      //                        ^
      offset += randomClass.length + 1
    }

    // <div class="bg-blue-500 text-white"></div>
    //                                  ^
    offset += 0

    // Mark the end of the class list
    list.source.scope[1] = offset
    attr.source.scope[1] = offset
  }

  // <div class=""></div>
  //             ^^^^^^^^
  offset += 8

  context.source.scope[1] = offset

  return new ScopeTree([context])
}

// let scopes1e1 = createScopes(1e1, 1e2)
// let length1e1 = scopes1e1.at(0)[0].source.scope[1]
// bench('scope#at (10 lists, 100 classes)', () => {
//   scopes1e1.at(Math.ceil(Math.random() * length1e1))
// })

// let scopes1e2 = createScopes(1e2, 1e2)
// let length1e2 = scopes1e2.at(0)[0].source.scope[1]
// bench('scope#at (100 lists, 10,000 classes)', () => {
//   scopes1e2.at(Math.ceil(Math.random() * length1e2))
// })

// let scopes1e3 = createScopes(1e3, 1e2)
// let length1e3 = scopes1e3.at(0)[0].source.scope[1]
// bench('scope#at (1,000 lists, 100,000 classes)', () => {
//   scopes1e3.at(Math.ceil(Math.random() * length1e3))
// })

// let scopes1e4 = createScopes(1e4, 1e2)
// let length1e4 = scopes1e4.at(0)[0].source.scope[1]
// bench('scope#at (10,000 lists, 1,000,000 classes)', () => {
//   scopes1e4.at(Math.ceil(Math.random() * length1e4))
// })

// let scopes1e5 = createScopes(1e5, 1e2)
// let length1e5 = scopes1e5.at(0)[0].source.scope[1]
// bench('scope#at (100,000 lists, 10,000,000 classes)', () => {
//   scopes1e5.at(Math.ceil(Math.random() * length1e5))
// })

let scopes1e6 = createScopes(1e6, 1e2)
let length1e6 = scopes1e6.at(0)[0].source.scope[1]
bench('scope#at (1,000,000 lists, 100,000,000 classes)', () => {
  scopes1e6.at(Math.ceil(Math.random() * length1e6))
})

// let scopes1e7 = createScopes(1e7, 1e2)
// let length1e7 = scopes1e7.at(0)[0].source.scope[1]
// bench('scope#at (1,000,000 lists, 100,000,000 classes)', () => {
//   scopes1e7.at(Math.ceil(Math.random() * length1e7))
// })

// let scopes1e8 = createScopes(1e8, 1e2)
// let length1e8 = scopes1e8.at(0)[0].source.scope[1]
// bench('scope#at (100,000,000 items)', () => {
//   scopes1e8.at(Math.ceil(Math.random() * length1e8))
// })

await run()
