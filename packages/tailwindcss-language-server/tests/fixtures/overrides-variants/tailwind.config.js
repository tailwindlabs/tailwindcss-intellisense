module.exports = {
  plugins: [
    function ({ addVariant, matchVariant }) {
      matchVariant('custom', (value) => `.custom:${value} &`, { values: { hover: 'hover' } })
      addVariant('custom-hover', `.custom:hover &:hover`)
    },
  ],
}
