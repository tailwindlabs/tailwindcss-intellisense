export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends ((...args: any) => any) | ReadonlyArray<any> | Date
    ? T[P]
    : T[P] extends (infer U)[]
      ? U[]
      : T[P] extends object
        ? DeepPartial<T[P]>
        : T[P]
}
