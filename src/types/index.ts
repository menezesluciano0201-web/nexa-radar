// src/types/index.ts
// Domain types matching the Supabase schema in supabase/migrations/001_init_schema.sql

export type UserTipo = 'admin' | 'prefeito' | 'deputado' | 'senador' | 'oscip'

export interface Profile {
  id: string
  tipo: UserTipo
  nome: string
  municipio_ibge: string | null
  parlamentar_id: string | null
  created_at: string
}

export type TipoProduto =
  | 'diagnostico'
  | 'monitoramento_prefeito'
  | 'monitoramento_parlamentar'
  | 'prestacao_contas'
  | 'licenca_plataforma'

export type StatusContrato = 'ativo' | 'suspenso' | 'encerrado'

export interface Contrato {
  id: string
  profile_id: string
  tipo_produto: TipoProduto
  status: StatusContrato
  valor_mensal: number | null
  data_inicio: string
  data_fim: string | null
  criado_em: string
}

export interface MunicipioHabilitacao {
  ibge: string
  nome: string
  uf: string
  populacao: number | null
  idh: number | null
  cauc_regular: boolean
  ultima_verificacao: string | null
  programas_habilitados: string[]
  programas_bloqueados: string[]
}

export interface TransferenciaFederal {
  id: string
  municipio_ibge: string
  programa: string
  fundo: string
  valor_empenhado: number
  valor_liquidado: number
  valor_pago: number
  percentual_execucao: number
  competencia: string | null
  prazo_limite: string | null
  fonte: string
  coletado_em: string
  raw_json?: unknown
}

export interface EmendaParlamentar {
  id: string
  parlamentar_id: string
  parlamentar_nome: string | null
  tipo: 'RP6' | 'RP7' | 'RP8' | 'PIX'
  parlamentar_tipo: 'individual' | 'bancada' | 'comissao'
  municipio_ibge: string | null
  area_tematica: string | null
  valor_autorizado: number
  valor_empenhado: number
  valor_executado: number
  percentual_execucao: number
  prazo_limite: string | null
  status_cauc: boolean | null
  exercicio: number
  fonte: string
  coletado_em: string
}

export type StatusDiagnostico = 'gerando' | 'rascunho' | 'entregue' | 'convertido' | 'erro'

export interface ProgramaCritico {
  programa: string
  fundo: string
  valor_empenhado: number
  valor_pago: number
  percentual_execucao: number
  prazo_limite: string | null
}

export interface Diagnostico {
  id: string
  municipio_ibge: string
  gerado_por: string
  valor_total_identificado: number
  valor_em_risco: number
  programas_criticos: ProgramaCritico[]
  acoes_recomendadas: string[]
  texto_ia: string | null
  pdf_url: string | null
  status: StatusDiagnostico
  criado_em: string
}

export type StatusBriefing = 'gerando' | 'rascunho' | 'entregue' | 'convertido' | 'erro'

export interface MunicipioRecomendado {
  ibge: string
  nome: string
  score_total: number
  justificativa: string
}

export interface Briefing {
  id: string
  parlamentar_id: string
  gerado_por: string
  valor_total_emendas: number
  valor_em_risco: number
  municipios_recomendados: MunicipioRecomendado[]
  texto_ia: string | null
  pdf_url: string | null
  status: StatusBriefing
  criado_em: string
}

export type RelacaoPolitica = 'aliado_forte' | 'aliado' | 'neutro' | 'oposicao'
export type OrigemMapa = 'manual' | 'inferido'

export interface MapaPolitico {
  id: string
  parlamentar_id: string
  municipio_ibge: string
  relacao: RelacaoPolitica
  liderancas_locais: string | null
  notas: string | null
  origem: OrigemMapa
  confianca_inferencia: number | null
  confirmado_pelo_assessor: boolean
  criado_por: string
  atualizado_em: string
}

export interface ScoreMunicipio {
  id: string
  parlamentar_id: string
  municipio_ibge: string
  score_total: number | null
  score_politico: number | null
  score_saude_alocacao: number | null
  score_capacidade: number | null
  score_impacto_visual: number | null
  score_idh: number | null
  calculado_em: string
}

export type TemplateName = 'scfv' | 'tea' | 'caps' | 'idoso' | 'esporte' | 'saude_basica' | 'educacao'
export type StatusProjeto = 'gerando' | 'rascunho' | 'erro'

export interface CampoForm {
  nome: string
  label: string
  tipo: 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'multi-select'
  opcoes?: string[]
  obrigatorio: boolean
}

export interface SecaoConfig {
  id: string
  titulo: string
  obrigatoria: boolean
  instrucoes: string
}

export interface RubricaOrcamento {
  codigo: string
  descricao: string
  percentualMaximo?: number
}

export interface TemplateConfig {
  nome: string
  orgao: string
  fundo: string
  camposEspecificos: CampoForm[]
  secoes: SecaoConfig[]
  indicadores: string[]
  rubricas: RubricaOrcamento[]
  declaracoesObrigatorias: string[]
  promptInstrucoes: string
  disclaimer: string
}

export interface ProjetoInputs {
  diagnostico_id: string
  municipio_ibge: string
  template: TemplateName
  objeto: string
  justificativa: string
  num_beneficiarios: number
  valor_solicitado: number
  valor_contrapartida: number
  prazo_meses: number
  oscip_executora?: string
  capacidade_instalada: string
  campos_extras: Record<string, unknown>
}

export interface Projeto {
  id: string
  diagnostico_id: string | null
  municipio_ibge: string
  gerado_por: string
  template: TemplateName
  objeto: string | null
  justificativa: string | null
  num_beneficiarios: number | null
  valor_solicitado: number | null
  valor_contrapartida: number | null
  prazo_meses: number | null
  oscip_executora: string | null
  capacidade_instalada: string | null
  campos_extras: Record<string, unknown> | null
  status: StatusProjeto
  secoes_ia: SecoesProjeto | null
  pdf_url: string | null
  docx_url: string | null
  criado_em: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface ItemOrcamento {
  rubrica: string
  descricao: string
  valor: number
}

export interface SecoesProjeto {
  metas_fisicas: Array<{ trimestre: number; meta: string; quantidade: number }>
  indicadores: Array<{ nome: string; formula: string; meta: string }>
  cronograma: Array<{ etapa: string; mes_inicio: number; mes_fim: number }>
  orcamento: Array<{ rubrica: string; descricao: string; valor: number }>
  declaracoes: string[]
  secoes_texto: Record<string, string>
}
