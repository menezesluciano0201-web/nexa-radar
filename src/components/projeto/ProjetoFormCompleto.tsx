'use client'

import { useMemo, useState } from 'react'
import { ProjetoForm } from './ProjetoForm'
import { getTemplate } from '@/lib/templates'
import type { CampoForm, TemplateName } from '@/types'

interface DiagnosticoOption {
  id: string
  municipio_ibge: string
  municipio_nome: string
  municipio_uf: string
  status: string
  criado_em: string
}

interface TemplateOption {
  name: TemplateName
  label: string
  orgao: string
  fundo: string
}

interface Props {
  diagnosticos: DiagnosticoOption[]
  templates: TemplateOption[]
}

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-nexa-500 focus:outline-none focus:ring-1 focus:ring-nexa-500'

const labelClass = 'block text-sm font-medium text-slate-300 mb-1'

export default function ProjetoFormCompleto({ diagnosticos, templates }: Props) {
  const [diagnosticoId, setDiagnosticoId] = useState('')
  const [template, setTemplate] = useState<TemplateName | ''>('')

  // Campos comuns
  const [objeto, setObjeto] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [numBeneficiarios, setNumBeneficiarios] = useState<number | ''>('')
  const [valorSolicitado, setValorSolicitado] = useState<number | ''>('')
  const [valorContrapartida, setValorContrapartida] = useState<number | ''>(0)
  const [prazoMeses, setPrazoMeses] = useState<number | ''>(12)
  const [oscipExecutora, setOscipExecutora] = useState('')
  const [capacidadeInstalada, setCapacidadeInstalada] = useState('')

  // Campos dinâmicos do template (por nome)
  const [camposExtras, setCamposExtras] = useState<Record<string, unknown>>({})

  const templateConfig = useMemo(
    () => (template ? getTemplate(template as TemplateName) : null),
    [template]
  )

  function handleTemplateChange(novo: TemplateName | '') {
    setTemplate(novo)
    setCamposExtras({}) // reset ao trocar template
  }

  function updateCampoExtra(nome: string, valor: unknown) {
    setCamposExtras((prev) => ({ ...prev, [nome]: valor }))
  }

  function toggleMultiSelect(nome: string, opcao: string) {
    setCamposExtras((prev) => {
      const atual = Array.isArray(prev[nome]) ? (prev[nome] as string[]) : []
      const next = atual.includes(opcao)
        ? atual.filter((v) => v !== opcao)
        : [...atual, opcao]
      return { ...prev, [nome]: next }
    })
  }

  // Validação mínima antes de permitir submeter
  const camposObrigatoriosOk = (() => {
    if (!diagnosticoId || !template || !templateConfig) return false
    if (!objeto.trim() || !justificativa.trim() || !capacidadeInstalada.trim()) return false
    if (!numBeneficiarios || numBeneficiarios <= 0) return false
    if (!valorSolicitado || valorSolicitado <= 0) return false
    if (!prazoMeses || prazoMeses < 1 || prazoMeses > 60) return false
    for (const campo of templateConfig.camposEspecificos) {
      if (!campo.obrigatorio) continue
      const v = camposExtras[campo.nome]
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
        return false
      }
    }
    return true
  })()

  const formData = {
    objeto,
    justificativa,
    num_beneficiarios: typeof numBeneficiarios === 'number' ? numBeneficiarios : 0,
    valor_solicitado: typeof valorSolicitado === 'number' ? valorSolicitado : 0,
    valor_contrapartida: typeof valorContrapartida === 'number' ? valorContrapartida : 0,
    prazo_meses: typeof prazoMeses === 'number' ? prazoMeses : 12,
    oscip_executora: oscipExecutora.trim() || undefined,
    capacidade_instalada: capacidadeInstalada,
    campos_extras: camposExtras,
  }

  return (
    <div className="space-y-8">
      {/* Bloco 1 — Diagnóstico + Template */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          1. Diagnóstico e Template
        </h2>

        <div>
          <label htmlFor="diagnostico" className={labelClass}>
            Diagnóstico de origem
          </label>
          <select
            id="diagnostico"
            value={diagnosticoId}
            onChange={(e) => setDiagnosticoId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">Selecione um diagnóstico...</option>
            {diagnosticos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.municipio_nome} — {d.municipio_uf} · {d.status} ·{' '}
                {new Date(d.criado_em).toLocaleDateString('pt-BR')}
              </option>
            ))}
          </select>
          {diagnosticos.length === 0 && (
            <p className="mt-2 text-xs text-yellow-400">
              Nenhum diagnóstico em status &quot;rascunho&quot; ou &quot;entregue&quot;.
              Gere um diagnóstico primeiro.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="template" className={labelClass}>
            Template do projeto
          </label>
          <select
            id="template"
            value={template}
            onChange={(e) => handleTemplateChange(e.target.value as TemplateName | '')}
            required
            className={inputClass}
          >
            <option value="">Selecione um template...</option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.label} ({t.orgao} / {t.fundo})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Bloco 2 — Campos comuns */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          2. Dados do Projeto
        </h2>

        <div>
          <label htmlFor="objeto" className={labelClass}>Objeto</label>
          <textarea
            id="objeto"
            value={objeto}
            onChange={(e) => setObjeto(e.target.value)}
            rows={3}
            required
            className={inputClass}
            placeholder="Descreva sucintamente o objeto do projeto..."
          />
        </div>

        <div>
          <label htmlFor="justificativa" className={labelClass}>Justificativa</label>
          <textarea
            id="justificativa"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={5}
            required
            className={inputClass}
            placeholder="Apresente os dados sociais e a necessidade do projeto..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="num_beneficiarios" className={labelClass}>
              Número de beneficiários
            </label>
            <input
              id="num_beneficiarios"
              type="number"
              min={1}
              value={numBeneficiarios}
              onChange={(e) =>
                setNumBeneficiarios(e.target.value === '' ? '' : Number(e.target.value))
              }
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="prazo_meses" className={labelClass}>
              Prazo (meses, 1–60)
            </label>
            <input
              id="prazo_meses"
              type="number"
              min={1}
              max={60}
              value={prazoMeses}
              onChange={(e) =>
                setPrazoMeses(e.target.value === '' ? '' : Number(e.target.value))
              }
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="valor_solicitado" className={labelClass}>
              Valor solicitado (R$)
            </label>
            <input
              id="valor_solicitado"
              type="number"
              min={0}
              step="0.01"
              value={valorSolicitado}
              onChange={(e) =>
                setValorSolicitado(e.target.value === '' ? '' : Number(e.target.value))
              }
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="valor_contrapartida" className={labelClass}>
              Contrapartida (R$)
            </label>
            <input
              id="valor_contrapartida"
              type="number"
              min={0}
              step="0.01"
              value={valorContrapartida}
              onChange={(e) =>
                setValorContrapartida(e.target.value === '' ? '' : Number(e.target.value))
              }
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="oscip_executora" className={labelClass}>
            OSCIP executora (opcional)
          </label>
          <input
            id="oscip_executora"
            type="text"
            value={oscipExecutora}
            onChange={(e) => setOscipExecutora(e.target.value)}
            className={inputClass}
            placeholder="Nome da entidade executora"
          />
        </div>

        <div>
          <label htmlFor="capacidade_instalada" className={labelClass}>
            Capacidade instalada da proponente
          </label>
          <textarea
            id="capacidade_instalada"
            value={capacidadeInstalada}
            onChange={(e) => setCapacidadeInstalada(e.target.value)}
            rows={3}
            required
            className={inputClass}
            placeholder="Estrutura física, equipe técnica, experiência prévia..."
          />
        </div>
      </section>

      {/* Bloco 3 — Campos dinâmicos do template */}
      {templateConfig && templateConfig.camposEspecificos.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            3. Campos específicos do template ({templateConfig.nome})
          </h2>
          {templateConfig.camposEspecificos.map((campo) => (
            <CampoDinamico
              key={campo.nome}
              campo={campo}
              valor={camposExtras[campo.nome]}
              onChange={(v) => updateCampoExtra(campo.nome, v)}
              onToggleMulti={(opcao) => toggleMultiSelect(campo.nome, opcao)}
            />
          ))}
        </section>
      )}

      {/* Submit + status (delegado ao ProjetoForm) */}
      <section className="border-t border-slate-800 pt-6">
        {!camposObrigatoriosOk && (
          <p className="mb-3 text-xs text-slate-500">
            Preencha todos os campos obrigatórios para habilitar a geração.
          </p>
        )}
        {camposObrigatoriosOk && template && (
          <ProjetoForm
            diagnosticoId={diagnosticoId}
            template={template as TemplateName}
            formData={formData}
          />
        )}
        {!camposObrigatoriosOk && (
          <button
            type="button"
            disabled
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed opacity-50"
          >
            Gerar Projeto
          </button>
        )}
      </section>
    </div>
  )
}

interface CampoDinamicoProps {
  campo: CampoForm
  valor: unknown
  onChange: (v: unknown) => void
  onToggleMulti: (opcao: string) => void
}

function CampoDinamico({ campo, valor, onChange, onToggleMulti }: CampoDinamicoProps) {
  const label = (
    <label htmlFor={`campo-${campo.nome}`} className={labelClass}>
      {campo.label}
      {campo.obrigatorio && <span className="text-red-400"> *</span>}
    </label>
  )

  if (campo.tipo === 'text') {
    return (
      <div>
        {label}
        <input
          id={`campo-${campo.nome}`}
          type="text"
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(e.target.value)}
          required={campo.obrigatorio}
          className={inputClass}
        />
      </div>
    )
  }

  if (campo.tipo === 'number') {
    return (
      <div>
        {label}
        <input
          id={`campo-${campo.nome}`}
          type="number"
          value={typeof valor === 'number' ? valor : ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? '' : Number(e.target.value))
          }
          required={campo.obrigatorio}
          className={inputClass}
        />
      </div>
    )
  }

  if (campo.tipo === 'textarea') {
    return (
      <div>
        {label}
        <textarea
          id={`campo-${campo.nome}`}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          required={campo.obrigatorio}
          className={inputClass}
        />
      </div>
    )
  }

  if (campo.tipo === 'select') {
    return (
      <div>
        {label}
        <select
          id={`campo-${campo.nome}`}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => onChange(e.target.value)}
          required={campo.obrigatorio}
          className={inputClass}
        >
          <option value="">Selecione...</option>
          {(campo.opcoes ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (campo.tipo === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <input
          id={`campo-${campo.nome}`}
          type="checkbox"
          checked={valor === true}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-nexa-600 focus:ring-nexa-500"
        />
        <label htmlFor={`campo-${campo.nome}`} className="text-sm text-slate-300">
          {campo.label}
          {campo.obrigatorio && <span className="text-red-400"> *</span>}
        </label>
      </div>
    )
  }

  if (campo.tipo === 'multi-select') {
    const selecionados = Array.isArray(valor) ? (valor as string[]) : []
    return (
      <div>
        {label}
        <div className="space-y-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2">
          {(campo.opcoes ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={selecionados.includes(opt)}
                onChange={() => onToggleMulti(opt)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-nexa-600 focus:ring-nexa-500"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    )
  }

  return null
}
