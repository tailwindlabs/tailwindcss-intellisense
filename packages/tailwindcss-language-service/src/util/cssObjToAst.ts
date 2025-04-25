/*
This is a modified version of the postcss-js 'parse' function which accepts the
postcss module as an argument. License below:

The MIT License (MIT)

Copyright 2015 Andrey Sitnik <andrey@sitnik.ru>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var IMPORTANT = /\s*!important\s*$/i

var unitless = {
  'box-flex': true,
  'box-flex-group': true,
  'column-count': true,
  flex: true,
  'flex-grow': true,
  'flex-positive': true,
  'flex-shrink': true,
  'flex-negative': true,
  'font-weight': true,
  'line-clamp': true,
  'line-height': true,
  opacity: true,
  order: true,
  orphans: true,
  'tab-size': true,
  widows: true,
  'z-index': true,
  zoom: true,
  'fill-opacity': true,
  'stroke-dashoffset': true,
  'stroke-opacity': true,
  'stroke-width': true,
}

function dashify(str) {
  return str
    .replace(/([A-Z])/g, '-$1')
    .replace(/^ms-/, '-ms-')
    .toLowerCase()
}

function decl(parent, name, value, postcss) {
  if (value === false || value === null) return

  name = dashify(name)
  if (typeof value === 'number') {
    if (value === 0 || unitless[name]) {
      value = value.toString()
    } else {
      value = value.toString() + 'px'
    }
  }

  if (name === 'css-float') name = 'float'

  if (IMPORTANT.test(value)) {
    value = value.replace(IMPORTANT, '')
    parent.push(postcss.decl({ prop: name, value: value, important: true }))
  } else {
    parent.push(postcss.decl({ prop: name, value: value }))
  }
}

function atRule(parent, parts, value, postcss) {
  var node = postcss.atRule({ name: parts[1], params: parts[3] || '' })
  if (typeof value === 'object') {
    node.nodes = []
    parse(value, node, postcss)
  }
  parent.push(node)
}

function parse(obj, parent, postcss) {
  var name, value, node, i
  for (name in obj) {
    if (obj.hasOwnProperty(name)) {
      value = obj[name]
      if (value === null || typeof value === 'undefined') {
        continue
      } else if (name[0] === '@') {
        var parts = name.match(/@([^\s]+)(\s+([\w\W]*)\s*)?/)
        if (Array.isArray(value)) {
          for (i = 0; i < value.length; i++) {
            atRule(parent, parts, value[i], postcss)
          }
        } else {
          atRule(parent, parts, value, postcss)
        }
      } else if (Array.isArray(value)) {
        for (i = 0; i < value.length; i++) {
          decl(parent, name, value[i], postcss)
        }
      } else if (typeof value === 'object') {
        node = postcss.rule({ selector: name })
        parse(value, node, postcss)
        parent.push(node)
      } else {
        decl(parent, name, value, postcss)
      }
    }
  }
}

import type { Postcss, Root } from 'postcss'

export function cssObjToAst(obj: any, postcss: Postcss): Root {
  var root = postcss.root()
  parse(obj, root, postcss)
  return root
}
