export type Comment = { index: number; value: string }

export function applyComments(str: string, comments: Comment[]): string {
  let offset = 0

  for (let comment of comments) {
    let index = comment.index + offset
    let commentStr = `/* ${comment.value} */`
    str = str.slice(0, index) + commentStr + str.slice(index)
    offset += commentStr.length
  }

  return str
}
