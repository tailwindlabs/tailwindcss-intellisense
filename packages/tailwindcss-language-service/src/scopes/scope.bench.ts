import { bench } from 'vitest'
import { Scopes, type Scope } from './scope'
import { Span } from '../util/state'

function createScopes(count: number) {
  let classNames = ['underline', 'flex', 'bg-red-500', 'text-white', 'p-2']

  // Create a dummy set of scopes representing a HTML file like this:
  // <div class="bg-blue-500 text-white"></div>
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ context.html
  //             ^^^^^^^^^^^^^^^^^^^^^^         class.list
  //             ^^^^^^^^^^^ ^^^^^^^^^^         class.name
  let list: Scope[] = []

  // <div class="|
  //             ^
  let offset = 12

  // <div class=""></div>
  //             ^^^^^^^^
  let endLength = 8

  list.push({ kind: 'context.html', span: [0, 0] })
  list.push({ kind: 'class.list', span: [offset, offset] })

  for (let i = 0; i < count; ++i) {
    let randomClass = classNames[Math.floor(Math.random() * classNames.length)]
    let span: Span = [offset, offset + randomClass.length]

    // Simulate a space after the class name
    offset += randomClass.length + 1

    list.push({ kind: 'class.name', span })
  }

  // Mark the end of the class list
  list[1].span[1] = offset - 1

  // Mark the end of the "document" context
  let length = offset - 1 + endLength
  list[0].span[1] = offset - 1 + endLength

  return new Scopes(list)
}

let scopes1e2 = createScopes(1e2)
let scopes1e4 = createScopes(1e4)
let scopes1e6 = createScopes(1e6)

let length1e2 = scopes1e2.at(0)[0].span[1]
let length1e4 = scopes1e4.at(0)[0].span[1]
let length1e6 = scopes1e6.at(0)[0].span[1]

bench('scope#at (100 items)', () => {
  scopes1e2.at(Math.ceil(Math.random() * length1e2))
})

bench('scope#at (10,000 items)', () => {
  scopes1e4.at(Math.ceil(Math.random() * length1e4))
})

bench('scope#at (1,000,000 items)', () => {
  scopes1e6.at(Math.ceil(Math.random() * length1e6))
})
