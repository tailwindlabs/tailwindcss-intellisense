if (process.argv.includes('--config-locations')) {
  require('./lsp/config-locations')
} else {
  require('./lsp/server')
}
