import type { TemplateConfig } from '@/types'

export const saude_basica: TemplateConfig = {
  nome: 'Atenção Primária à Saúde',
  orgao: 'MS / SUS',
  fundo: 'FNS',
  camposEspecificos: [
    {
      nome: 'tipo_equipe',
      label: 'Tipo de equipe',
      tipo: 'select',
      opcoes: ['ESF (Equipe de Saúde da Família)', 'NASF-AB', 'UBS sem ESF'],
      obrigatorio: true,
    },
    {
      nome: 'numero_equipes',
      label: 'Número de equipes implantadas/ampliadas',
      tipo: 'number',
      obrigatorio: true,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto: tipo de equipe (ESF/NASF-AB/UBS), número de equipes, cobertura territorial estimada e município. Referencie a Política Nacional de Atenção Básica (PNAB 2017).',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente indicadores de cobertura da APS no município (% população coberta por ESF, número de UBS, IDSUS), mortalidade infantil, doenças crônicas prevalentes. Justifique a necessidade das equipes pelo déficit de cobertura.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Descreva a composição das equipes (conforme PNAB: médico, enfermeiro, técnico de enfermagem, ACS), áreas de abrangência, ações programáticas (pré-natal, hipertensos/diabéticos, saúde da criança, saúde bucal). Para NASF-AB: liste profissionais e apoio matricial.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva UBS disponível (área, equipamentos), sistema de informação (e-SUS APS), equipe de gestão municipal de saúde e histórico de cobertura ESF.',
    },
  ],
  indicadores: [
    'Percentual de população coberta pela ESF',
    'Número de consultas de pré-natal realizadas (≥6 consultas)',
    'Taxa de cobertura vacinal (DTP, poliomielite)',
    'Número de pacientes hipertensos/diabéticos acompanhados',
    'Número de visitas domiciliares por ACS mensalmente',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - PF (profissionais de saúde)', percentualMaximo: 0.65 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (insumos, medicamentos básicos)', percentualMaximo: 0.15 },
    { codigo: '4.4.90.52', descricao: 'Equipamentos e Material Permanente (equipamentos médicos)', percentualMaximo: 0.10 },
    { codigo: '3.3.90.47', descricao: 'Obrigações Tributárias', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'O gestor municipal declara que as equipes serão cadastradas no CNES após habilitação.',
    'O gestor declara que o município atende aos requisitos de contrapartida do Piso da Atenção Básica (PAB).',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNS/MS para Atenção Primária à Saúde (APS), conforme Política Nacional de Atenção Básica (PNAB 2017 — Portaria 2.436/2017) e Nota Técnica de habilitação de ESF. IMPORTANTE: saúde básica opera via repasse fundo-a-fundo (FNS → Fundo Municipal de Saúde), não via Transferegov — mencione isso no contexto. O cadastro das equipes é feito no SCNES (Sistema de Cadastro Nacional de Estabelecimentos de Saúde). Use terminologia SUS/APS: adstrição de clientela, microárea, agente comunitário de saúde (ACS), território de saúde, Caderno de Ações Programáticas (CAP).`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. A habilitação de equipes ESF requer cadastro no SCNES e habilitação pelo DAB/MS. O repasse é fundo-a-fundo (FNS → FMS), não via Transferegov. Revisar com gestor municipal de saúde antes de qualquer encaminhamento. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
