// src/app/admin/projeto/novo/page.tsx
import { requireAdminClient } from '@/lib/require-admin'
import { getTemplate, TEMPLATE_NAMES } from '@/lib/templates'
import ProjetoFormCompleto from '@/components/projeto/ProjetoFormCompleto'
import { IBGE_RE } from '@/lib/format'

export default async function NovoProjetoPage({
  searchParams,
}: {
  searchParams: Promise<{ ibge?: string; from?: string }>
}) {
  const admin = await requireAdminClient()
  const { ibge: ibgeParam } = await searchParams
  const ibgeFiltro = ibgeParam && IBGE_RE.test(ibgeParam) ? ibgeParam : null

  // Busca diagnósticos disponíveis (rascunho/entregue), filtrando por ibge se fornecido
  let query = admin
    .from('diagnosticos')
    .select('id, municipio_ibge, status, criado_em')
    .in('status', ['rascunho', 'entregue'])
    .order('criado_em', { ascending: false })
    .limit(200)
  if (ibgeFiltro) query = query.eq('municipio_ibge', ibgeFiltro)

  const { data: diagnosticosRaw } = await query
  const diagnosticos = diagnosticosRaw ?? []

  // Resolve nomes/UF dos municípios em uma única query
  const ibges = Array.from(new Set(diagnosticos.map((d) => d.municipio_ibge)))
  let municipiosMap = new Map<string, { nome: string; uf: string }>()
  if (ibges.length > 0) {
    const { data: municipios } = await admin
      .from('municipios_habilitacao')
      .select('ibge, nome, uf')
      .in('ibge', ibges)
    municipiosMap = new Map(
      (municipios ?? []).map((m) => [m.ibge, { nome: m.nome, uf: m.uf }])
    )
  }

  const diagnosticosOptions = diagnosticos.map((d) => {
    const muni = municipiosMap.get(d.municipio_ibge)
    return {
      id: d.id,
      municipio_ibge: d.municipio_ibge,
      municipio_nome: muni?.nome ?? d.municipio_ibge,
      municipio_uf: muni?.uf ?? '—',
      status: d.status,
      criado_em: d.criado_em,
    }
  })

  // Lista dos 7 templates a partir do registry
  const templates = TEMPLATE_NAMES.map((name) => {
    const cfg = getTemplate(name)
    return {
      name,
      label: cfg.nome,
      orgao: cfg.orgao,
      fundo: cfg.fundo,
    }
  })

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-1">Novo Projeto</h1>
      <p className="text-slate-400 text-sm mb-8">
        {ibgeFiltro
          ? 'Diagnósticos pré-filtrados para o município selecionado no Radar.'
          : 'Selecione um diagnóstico, escolha o template e preencha os campos. A IA gerará o projeto aprovável em PDF + Word (até 90 segundos).'}
      </p>
      <ProjetoFormCompleto
        diagnosticos={diagnosticosOptions}
        templates={templates}
      />
    </div>
  )
}
