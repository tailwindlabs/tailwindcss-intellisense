import { spliceChangesIntoString } from './splice-changes-into-string'

export type Comment = { index: number; value: string }

export function applyComments(str: string, comments: Comment[]): string {
  return spliceChangesIntoString(
    str,
    comments.map((c) => ({
      start: c.index,
      end: c.index,
      replacement: ` /* ${c.value} */`,
    })),
  )
}
