// src/app/admin/portal/[ibge]/publicacao/[id]/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient, requireAdminClientWithUser } from '@/lib/require-admin'
import { IBGE_RE, UUID_RE } from '@/lib/format'
import type { PublicacaoFoto } from '@/types'

async function revalidarPortal(ibge: string) {
  const admin = await requireAdminClient()
  const { data } = await admin
    .from('municipios_habilitacao')
    .select('uf, slug')
    .eq('ibge', ibge)
    .single()
  if (data) revalidatePath(`/p/${data.uf.toLowerCase()}/${data.slug}`)
}

export async function salvarPublicacao(formData: FormData) {
  const ibge = formData.get('ibge') as string
  const idRaw = (formData.get('id') as string) || 'nova'
  if (!IBGE_RE.test(ibge)) redirect('/admin/portal')

  const { admin, user } = await requireAdminClientWithUser()

  const titulo = ((formData.get('titulo') as string) ?? '').trim()
  if (!titulo) redirect(`/admin/portal/${ibge}/publicacao/${idRaw}?error=titulo_obrigatorio`)

  const descricao = ((formData.get('descricao') as string) ?? '').trim() || null
  const valor_destaque = ((formData.get('valor_destaque') as string) ?? '').trim() || null
  const data_evento = ((formData.get('data_evento') as string) ?? '').trim() || null
  const lat = parseFloat(formData.get('lat') as string)
  const lng = parseFloat(formData.get('lng') as string)
  const ativo = formData.get('ativo') === 'on'

  const payload = {
    municipio_ibge: ibge,
    aprovado_por: user.id,
    titulo,
    descricao,
    valor_destaque,
    data_evento,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    ativo,
    resumo_execucao: {} as Record<string, unknown>,
    publicado_em: new Date().toISOString(),
  }

  let novoId = idRaw
  if (idRaw === 'nova') {
    const { data, error } = await admin
      .from('publicacoes_portal')
      .insert(payload)
      .select('id')
      .single()
    if (error || !data) redirect(`/admin/portal/${ibge}?error=insert_failed`)
    novoId = data!.id
  } else {
    if (!UUID_RE.test(idRaw)) redirect('/admin/portal')
    const { error } = await admin
      .from('publicacoes_portal')
      .update(payload)
      .eq('id', idRaw)
      .eq('municipio_ibge', ibge)
    if (error) redirect(`/admin/portal/${ibge}/publicacao/${idRaw}?error=update_failed`)
  }

  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}/publicacao/${novoId}?ok=1`)
}

export async function uploadFoto(formData: FormData) {
  const ibge = formData.get('ibge') as string
  const id = formData.get('id') as string
  const file = formData.get('file') as File | null
  const alt = ((formData.get('alt') as string) ?? '').trim()
  if (!IBGE_RE.test(ibge) || !UUID_RE.test(id) || !file) {
    redirect(`/admin/portal/${ibge}/publicacao/${id}?error=upload_invalid`)
  }

  const admin = await requireAdminClient()
  const ext = file!.name.split('.').pop() || 'jpg'
  const path = `${ibge}/publicacao/${id}/${Date.now()}.${ext}`

  const { error: upErr } = await admin.storage
    .from('portal-fotos')
    .upload(path, file!, { contentType: file!.type })

  if (upErr) redirect(`/admin/portal/${ibge}/publicacao/${id}?error=upload_failed`)

  const { data: pub } = admin.storage.from('portal-fotos').getPublicUrl(path)

  const { data: existente } = await admin
    .from('publicacoes_portal')
    .select('fotos')
    .eq('id', id)
    .single()

  const fotos = ((existente?.fotos as PublicacaoFoto[]) ?? [])
  const novaOrdem = fotos.length === 0 ? 1 : Math.max(...fotos.map(f => f.ordem)) + 1
  fotos.push({ url: pub.publicUrl, alt: alt || 'Foto', ordem: novaOrdem })

  await admin.from('publicacoes_portal').update({ fotos }).eq('id', id)

  revalidatePath(`/admin/portal/${ibge}/publicacao/${id}`)
  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}/publicacao/${id}?ok=1`)
}

export async function removeFoto(formData: FormData) {
  const ibge = formData.get('ibge') as string
  const id = formData.get('id') as string
  const ordem = parseInt(formData.get('ordem') as string, 10)
  if (!IBGE_RE.test(ibge) || !UUID_RE.test(id)) redirect('/admin/portal')

  const admin = await requireAdminClient()
  const { data } = await admin.from('publicacoes_portal').select('fotos').eq('id', id).single()
  const fotos = ((data?.fotos as PublicacaoFoto[]) ?? []).filter(f => f.ordem !== ordem)
  await admin.from('publicacoes_portal').update({ fotos }).eq('id', id)

  revalidatePath(`/admin/portal/${ibge}/publicacao/${id}`)
  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}/publicacao/${id}`)
}

export async function deletePublicacao(formData: FormData) {
  const ibge = formData.get('ibge') as string
  const id = formData.get('id') as string
  if (!IBGE_RE.test(ibge) || !UUID_RE.test(id)) redirect('/admin/portal')

  const admin = await requireAdminClient()
  await admin.from('publicacoes_portal').delete().eq('id', id).eq('municipio_ibge', ibge)

  revalidatePath(`/admin/portal/${ibge}`)
  await revalidarPortal(ibge)
  redirect(`/admin/portal/${ibge}?aba=publicacoes`)
}
