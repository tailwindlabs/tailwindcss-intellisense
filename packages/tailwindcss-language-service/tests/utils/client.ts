import { Settings, State } from '../../src'
import postcss from 'postcss'
import { createLanguageService, createState } from '../../src'
import { supportedFeatures } from '../../src/features'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI, Utils as URIUtils } from 'vscode-uri'
import { createConfiguration } from './configuration'
import { DeepPartial } from '../../src/types'
import { createFileSystem, Storage } from './fs'

export interface ClientOptions {
  config:
    | { kind: 'css'; content: string }
    | { kind: 'module'; content: any }
    | { kind: 'custom'; content: (state: State) => State }

  /**
   * In-memory filesystem structure
   */
  fs?: Storage
}

export interface DocumentDescriptor {
  /**
   * The language the document is written in
   */
  lang: string

  /**
   * The content of the document
   */
  text: string

  /**
   * The name or file path to the document
   *
   * By default a unique path is generated at the root of the workspace
   */
  name?: string

  /**
   * Custom settings / config for this document
   */
  settings?: DeepPartial<Settings>
}

export async function createClient(options: ClientOptions) {
  if (options.config.kind !== 'css') {
    throw new Error('unsupported')
  }

  let { version } = require('tailwindcss-v4/package.json')
  let tailwindcss = await import('tailwindcss-v4')

  let design = await tailwindcss.__unstable__loadDesignSystem(options.config.content)

  // Step 4: Augment the design system with some additional APIs that the LSP needs
  Object.assign(design, {
    dependencies: () => [],

    // TODOs:
    //
    // 1. Remove PostCSS parsing — its roughly 60% of the processing time
    // ex: compiling 19k classes take 650ms and 400ms of that is PostCSS
    //
    // - Replace `candidatesToCss` with a `candidatesToAst` API
    // First step would be to convert to a PostCSS AST by transforming the nodes directly
    // Then it would be to drop the PostCSS AST representation entirely in all v4 code paths
    compile(classes: string[]): (postcss.Root | null)[] {
      let css = design.candidatesToCss(classes)
      let errors: any[] = []

      let roots = css.map((str) => {
        if (str === null) return postcss.root()

        try {
          return postcss.parse(str.trimEnd())
        } catch (err) {
          errors.push(err)
          return postcss.root()
        }
      })

      if (errors.length > 0) {
        console.error(JSON.stringify(errors))
      }

      return roots
    },

    toCss(nodes: postcss.Root | postcss.Node[]): string {
      return Array.isArray(nodes)
        ? postcss.root({ nodes }).toString().trim()
        : nodes.toString().trim()
    },
  })

  let config = createConfiguration()

  let state = createState({
    v4: true,
    version,
    designSystem: design as any,
    // TODO: This should not be necessary
    blocklist: Array.from(design.invalidCandidates),
    features: supportedFeatures(version, tailwindcss),
    editor: {
      getConfiguration: async (uri) => config.get(uri),
    },
  })

  let service = createLanguageService({
    state: () => state,
    fs: createFileSystem(options.fs ?? {}),
  })

  let index = 0
  function open(desc: DocumentDescriptor) {
    let uri = URIUtils.resolvePath(
      URI.parse('file://projects/root'),
      desc.name ? desc.name : `file-${++index}.${desc.lang}`,
    ).toString()

    if (desc.settings) {
      config.set(uri, desc.settings)
    }

    return service.open(TextDocument.create(uri, desc.lang, 1, desc.text))
  }

  return {
    ...service,
    open,
  }
}
