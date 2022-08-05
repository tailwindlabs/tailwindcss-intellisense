declare module 'becke-ch--regex--s0-0-v1--base--pl--lib' {
  export default class Regex {
    constructor(regex: string, modifiers?: string)
    exec(str: string): null | (string[] & { index: number[] })
  }
}
