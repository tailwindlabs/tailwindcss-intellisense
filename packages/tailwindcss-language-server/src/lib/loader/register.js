import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { MessageChannel } from 'node:worker_threads'

export function register() {
  const { port1, port2 } = new MessageChannel()

  // Port 1 is the "local" port
  port1.on('message', (msg) => console.log(msg))
  port1.unref()

  return {}
}

// // This example showcases how a message channel can be used to
// // communicate with the hooks, by sending `port2` to the hooks.
// const { port1, port2 } = new MessageChannel()

// port1.on('message', (msg) => {
//   console.log(msg)
// })
// port1.unref()

// register('./my-hooks.mjs', {
//   parentURL: pathToFileURL(__filename),
//   data: { number: 1, port: port2 },
//   transferList: [port2],
// })
