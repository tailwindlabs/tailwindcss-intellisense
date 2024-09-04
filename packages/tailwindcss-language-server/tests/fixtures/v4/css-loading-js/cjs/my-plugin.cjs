const plugin = require('tailwindcss/plugin')

module.exports = plugin(
  () => {
    //
  },
  {
    theme: {
      extend: {
        colors: {
          'cjs-from-plugin': 'black',
        },
      },
    },
  },
)
