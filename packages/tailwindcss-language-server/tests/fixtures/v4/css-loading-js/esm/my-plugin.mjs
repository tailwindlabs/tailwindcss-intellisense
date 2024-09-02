import plugin from 'tailwindcss/plugin'

export default plugin(
  () => {
    //
  },
  {
    theme: {
      extend: {
        colors: {
          'esm-from-plugin': 'black',
        },
      },
    },
  },
)
