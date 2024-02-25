export type ArbitraryModifier = {
  kind: 'arbitrary'
  value: string
  dashedIdent: string | null
}

export type ArbitraryVariantValue = {
  kind: 'arbitrary'
  value: string
}

export type NamedVariantValue = {
  kind: 'named'
  value: string
}

export type NamedVariant = {
  kind: 'named'
  root: string
  modifier: ArbitraryModifier | NamedModifier | null
  value: ArbitraryVariantValue | NamedVariantValue | null
}

export type NamedModifier = {
  kind: 'named'
  value: string
}
