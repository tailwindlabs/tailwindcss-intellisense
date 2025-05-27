export interface ScopeEntry {
  content: Promise<{ default: object }>
  inject: string[]
}

export const KNOWN_SCOPES: Record<string, ScopeEntry> = {
  'source.css': {
    content: import('../syntaxes/css.json'),
    inject: [
      'tailwindcss.at-rules.injection',
      'tailwindcss.at-apply.injection',
      'tailwindcss.theme-fn.injection',
      'tailwindcss.screen-fn.injection',
    ],
  },

  'source.css.tailwind': {
    content: import('../../vscode-tailwindcss/syntaxes/source.css.tailwind.tmLanguage.json'),
    inject: [],
  },

  'tailwindcss.at-apply.injection': {
    content: import('../../vscode-tailwindcss/syntaxes/at-apply.tmLanguage.json'),
    inject: [],
  },

  'tailwindcss.at-rules.injection': {
    content: import('../../vscode-tailwindcss/syntaxes/at-rules.tmLanguage.json'),
    inject: [],
  },

  'tailwindcss.theme-fn.injection': {
    content: import('../../vscode-tailwindcss/syntaxes/theme-fn.tmLanguage.json'),
    inject: [],
  },

  'tailwindcss.screen-fn.injection': {
    content: import('../../vscode-tailwindcss/syntaxes/screen-fn.tmLanguage.json'),
    inject: [],
  },
}
