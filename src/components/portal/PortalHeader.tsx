// src/components/portal/PortalHeader.tsx
import Image from 'next/image'
import type { MunicipioBranding } from '@/types'
import { DEFAULT_COR_PRIMARIA } from '@/lib/portal'

interface Props {
  nome: string
  uf: string
  branding: MunicipioBranding | null
}

export function PortalHeader({ nome, uf, branding }: Props) {
  const cor = branding?.cor_primaria ?? DEFAULT_COR_PRIMARIA
  return (
    <header className="px-4 py-6 text-white" style={{ backgroundColor: cor }}>
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        {branding?.logo_url && (
          <Image
            src={branding.logo_url}
            alt="Logo da prefeitura"
            width={64}
            height={64}
            className="rounded-md bg-white/10 p-1"
          />
        )}
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Prefeitura de {nome} — {uf.toUpperCase()}</h1>
          {branding?.prefeito_gestao && (
            <p className="text-sm opacity-90">{branding.prefeito_gestao}</p>
          )}
          {branding?.prefeito_nome && (
            <p className="text-xs opacity-80">{branding.prefeito_nome}</p>
          )}
        </div>
      </div>
    </header>
  )
}
