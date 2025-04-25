import type { State } from './state'
import dlv from 'dlv'

export function flagEnabled(state: State, flag: string): boolean {
  if (state.featureFlags.future.includes(flag)) {
    return state.config.future === 'all' || dlv(state.config, ['future', flag], false)
  }

  if (state.featureFlags.experimental.includes(flag)) {
    return state.config.experimental === 'all' || dlv(state.config, ['experimental', flag], false)
  }

  return false
}
