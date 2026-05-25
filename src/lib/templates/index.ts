import type { TemplateConfig, TemplateName } from '@/types'
import { scfv } from './scfv'
import { tea } from './tea'
import { caps } from './caps'
import { idoso } from './idoso'
import { esporte } from './esporte'
import { saude_basica } from './saude_basica'
import { educacao } from './educacao'

const registry: Record<TemplateName, TemplateConfig> = {
  scfv,
  tea,
  caps,
  idoso,
  esporte,
  saude_basica,
  educacao,
}

export function getTemplate(name: TemplateName): TemplateConfig {
  const config = registry[name]
  if (!config) throw new Error(`Template desconhecido: ${name}`)
  return config
}

export const TEMPLATE_NAMES: TemplateName[] = Object.keys(registry) as TemplateName[]
