import _getModuleDependencies from 'tailwindcss/lib/lib/getModuleDependencies'

export function getModuleDependencies(modulePath: string): string[] {
  return _getModuleDependencies(modulePath)
    .map(({ file }) => file)
    .filter((file) => file !== modulePath)
}
