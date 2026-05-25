// src/components/portal/PortalFooter.tsx
import Image from 'next/image'
import type { MunicipioBranding } from '@/types'

interface Props {
  nome: string
  uf: string
  branding: MunicipioBranding | null
}

export function PortalFooter({ nome, uf, branding }: Props) {
  return (
    <footer className="px-4 py-8 bg-slate-900 text-slate-300">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-4 text-center">
        {branding?.brasao_url && (
          <Image src={branding.brasao_url} alt="Brasão municipal" width={48} height={48} />
        )}
        <p className="text-sm">Prefeitura Municipal de {nome} — {uf.toUpperCase()}</p>
        <p className="text-xs text-slate-500">
          Powered by{' '}
          <a
            href="https://nexaradar.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-nexa-400 hover:text-nexa-300"
          >
            Nexa Radar
          </a>
        </p>
      </div>
    </footer>
  )
}
