if (process.argv.includes('--definition')) {
  require('./lsp/definition')
} else {
  require('./lsp/server')
}
