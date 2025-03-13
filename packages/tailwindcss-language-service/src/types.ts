export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? U[]
    : T[P] extends (...args: any) => any
      ? T[P] | undefined
      : T[P] extends object
        ? DeepPartial<T[P]>
        : T[P]
}
