// src/app/admin/portal/[ibge]/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient, requireAdminClientWithUser } from '@/lib/require-admin'
import { IBGE_RE } from '@/lib/format'
import { DEFAULT_COR_PRIMARIA } from '@/lib/portal'

// Recebe o admin client já autenticado para não rodar auth+profile lookup duas vezes.
async function revalidarPortal(admin: Awaited<ReturnType<typeof requireAdminClient>>, ibge: string) {
  const { data } = await admin
    .from('municipios_habilitacao')
    .select('uf, slug')
    .eq('ibge', ibge)
    .single()
  if (data) revalidatePath(`/p/${data.uf.toLowerCase()}/${data.slug}`)
}

export async function salvarBranding(formData: FormData) {
  const ibge = formData.get('ibge') as string
  if (!IBGE_RE.test(ibge)) redirect('/admin/portal')

  const { admin, user } = await requireAdminClientWithUser()

  const cor = ((formData.get('cor_primaria') as string) ?? '').trim() || DEFAULT_COR_PRIMARIA
  const prefeito_nome = ((formData.get('prefeito_nome') as string) ?? '').trim() || null
  const prefeito_gestao = ((formData.get('prefeito_gestao') as string) ?? '').trim() || null

  await admin
    .from('municipios_branding')
    .upsert({
      municipio_ibge: ibge,
      cor_primaria: cor,
      prefeito_nome,
      prefeito_gestao,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user.id,
    }, { onConflict: 'municipio_ibge' })

  revalidatePath(`/admin/portal/${ibge}`)
  await revalidarPortal(admin, ibge)
  redirect(`/admin/portal/${ibge}?aba=identidade&ok=1`)
}

export async function salvarKpis(formData: FormData) {
  const ibge = formData.get('ibge') as string
  if (!IBGE_RE.test(ibge)) redirect('/admin/portal')

  const admin = await requireAdminClient()

  // Limpa e re-insere — simples e idempotente. 4 linhas no máximo.
  await admin.from('municipios_kpi_portal').delete().eq('municipio_ibge', ibge)

  const inserts = []
  for (let i = 1; i <= 4; i++) {
    const label = ((formData.get(`label_${i}`) as string) ?? '').trim()
    const valor = ((formData.get(`valor_${i}`) as string) ?? '').trim()
    const sufixo = ((formData.get(`sufixo_${i}`) as string) ?? '').trim() || null
    if (label && valor) {
      inserts.push({ municipio_ibge: ibge, ordem: i, label, valor, sufixo })
    }
  }
  if (inserts.length > 0) {
    await admin.from('municipios_kpi_portal').insert(inserts)
  }

  revalidatePath(`/admin/portal/${ibge}`)
  await revalidarPortal(admin, ibge)
  redirect(`/admin/portal/${ibge}?aba=kpis&ok=1`)
}

export async function togglePublicacao(formData: FormData) {
  const id = formData.get('id') as string
  const ibge = formData.get('ibge') as string
  const ativo = formData.get('ativo') === 'true'
  if (!IBGE_RE.test(ibge)) redirect('/admin/portal')

  const admin = await requireAdminClient()
  await admin.from('publicacoes_portal').update({ ativo: !ativo }).eq('id', id)

  revalidatePath(`/admin/portal/${ibge}`)
  await revalidarPortal(admin, ibge)
  redirect(`/admin/portal/${ibge}?aba=publicacoes`)
}

export async function uploadLogoOuBrasao(formData: FormData) {
  const ibge = formData.get('ibge') as string
  const tipo = formData.get('tipo') as 'logo' | 'brasao'
  const file = formData.get('file') as File | null
  if (!IBGE_RE.test(ibge) || (tipo !== 'logo' && tipo !== 'brasao') || !file) {
    redirect(`/admin/portal/${ibge}?aba=identidade&error=invalid`)
  }

  const admin = await requireAdminClient()
  const ext = file!.name.split('.').pop() || 'png'
  const path = `${ibge}/${tipo}.${ext}`

  const { error: upErr } = await admin.storage
    .from('portal-fotos')
    .upload(path, file!, { upsert: true, contentType: file!.type })

  if (upErr) redirect(`/admin/portal/${ibge}?aba=identidade&error=upload`)

  const { data: pub } = admin.storage.from('portal-fotos').getPublicUrl(path)

  await admin
    .from('municipios_branding')
    .upsert({
      municipio_ibge: ibge,
      [`${tipo}_url`]: pub.publicUrl,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'municipio_ibge' })

  revalidatePath(`/admin/portal/${ibge}`)
  await revalidarPortal(admin, ibge)
  redirect(`/admin/portal/${ibge}?aba=identidade&ok=1`)
}
