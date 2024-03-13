import { readFile } from 'node:fs/promises'
import { getTextWithoutComments } from '@tailwindcss/language-service/src/util/doc'

export async function readCssFile(filepath: string): Promise<string | null> {
  try {
    let contents = await readFile(filepath, 'utf8')
    return getTextWithoutComments(contents, 'css')
  } catch {
    return null
  }
}
