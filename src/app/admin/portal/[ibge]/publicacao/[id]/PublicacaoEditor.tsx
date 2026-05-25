// src/app/admin/portal/[ibge]/publicacao/[id]/PublicacaoEditor.tsx
'use client'

import { useState } from 'react'
import { validarFotoUpload } from '@/lib/upload'

export function PublicacaoFotoUpload() {
  const [erro, setErro] = useState<string | null>(null)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const v = validarFotoUpload(file, 'publicacao')
    if (!v.valid) {
      setErro(v.erro ?? 'Inválido')
      e.target.value = ''
    } else {
      setErro(null)
    }
  }

  return (
    <div>
      <input
        type="file"
        name="file"
        accept="image/png,image/jpeg,image/webp"
        required
        onChange={onFileChange}
        className="text-sm text-slate-300"
      />
      {erro && <p className="mt-1 text-xs text-red-400">{erro}</p>}
    </div>
  )
}
