// src/app/admin/portal/[ibge]/IdentidadeForm.tsx
'use client'

import { useState } from 'react'
import type { MunicipioBranding } from '@/types'
import { salvarBranding, uploadLogoOuBrasao } from './actions'

interface Props {
  ibge: string
  branding: MunicipioBranding | null
}

export function IdentidadeForm({ ibge, branding }: Props) {
  const [cor, setCor] = useState(branding?.cor_primaria ?? '#0284c7')

  return (
    <div className="space-y-6">
      {/* Upload de logo */}
      <form action={uploadLogoOuBrasao} className="rounded-md border border-slate-800 p-4 space-y-3">
        <input type="hidden" name="ibge" value={ibge} />
        <input type="hidden" name="tipo" value="logo" />
        <label className="block text-sm font-medium text-slate-300">Logo da Prefeitura</label>
        {branding?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logo_url} alt="Logo atual" className="h-16 bg-slate-800 rounded p-2" />
        )}
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          className="text-sm text-slate-300"
        />
        <button type="submit" className="rounded-md bg-nexa-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-nexa-500">
          Enviar logo
        </button>
      </form>

      {/* Upload de brasão */}
      <form action={uploadLogoOuBrasao} className="rounded-md border border-slate-800 p-4 space-y-3">
        <input type="hidden" name="ibge" value={ibge} />
        <input type="hidden" name="tipo" value="brasao" />
        <label className="block text-sm font-medium text-slate-300">Brasão</label>
        {branding?.brasao_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.brasao_url} alt="Brasão atual" className="h-16 bg-slate-800 rounded p-2" />
        )}
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          className="text-sm text-slate-300"
        />
        <button type="submit" className="rounded-md bg-nexa-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-nexa-500">
          Enviar brasão
        </button>
      </form>

      {/* Cor primária + nome do prefeito */}
      <form action={salvarBranding} className="rounded-md border border-slate-800 p-4 space-y-4">
        <input type="hidden" name="ibge" value={ibge} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Cor primária</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                name="cor_primaria"
                value={cor}
                onChange={e => setCor(e.target.value)}
                className="h-10 w-16 rounded border border-slate-700 bg-slate-800"
              />
              <code className="text-xs text-slate-400">{cor}</code>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nome do prefeito</label>
            <input
              type="text"
              name="prefeito_nome"
              defaultValue={branding?.prefeito_nome ?? ''}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Gestão (ex: Gestão 2025-2028)</label>
          <input
            type="text"
            name="prefeito_gestao"
            defaultValue={branding?.prefeito_gestao ?? ''}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-nexa-600 px-4 py-2 text-sm font-semibold text-white hover:bg-nexa-500"
        >
          Salvar identidade
        </button>
      </form>
    </div>
  )
}
