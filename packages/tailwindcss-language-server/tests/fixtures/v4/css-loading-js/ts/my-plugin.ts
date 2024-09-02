import type { PluginAPI } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

export default plugin(
  (api: PluginAPI) => {
    //
  },
  {
    theme: {
      extend: {
        colors: {
          'ts-from-plugin': 'black',
        },
      },
    },
  },
)
