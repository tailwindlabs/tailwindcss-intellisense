import type { Color } from 'culori'

declare module 'culori' {
  export function inGamut(mode: string): (color: Color | string) => boolean
}
