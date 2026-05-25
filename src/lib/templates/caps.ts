import type { TemplateConfig } from '@/types'

export const caps: TemplateConfig = {
  nome: 'Centro de Atenção Psicossocial (CAPS)',
  orgao: 'MS / SUS',
  fundo: 'FNS',
  camposEspecificos: [
    {
      nome: 'modalidade',
      label: 'Modalidade do CAPS',
      tipo: 'select',
      opcoes: ['CAPS I', 'CAPS II', 'CAPS III', 'CAPSad', 'CAPSi'],
      obrigatorio: true,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto mencionando a modalidade CAPS, o porte do município, a clientela-alvo (transtornos mentais graves/persistentes ou uso de álcool e drogas) e a abrangência territorial.',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente indicadores epidemiológicos de saúde mental do município (internações psiquiátricas, CAPS/100mil hab, cobertura da RAPS). Referencie a Portaria GM/MS 3.088/2011 (RAPS) e a Portaria 3.588/2017 (habilitação CAPS). Justifique a modalidade escolhida pelo porte populacional.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Descreva os serviços ofertados: acolhimento, atendimento individual, grupos terapêuticos, visita domiciliar, articulação com RAPS. Liste a equipe mínima conforme Portaria 3.588/2017 para a modalidade. Inclua carga horária de funcionamento.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva estrutura física (área mínima por modalidade conforme RDC ANVISA 50), equipe técnica com registros profissionais, e experiência em saúde mental comunitária.',
    },
  ],
  indicadores: [
    'Número de usuários ativos (com PTS vigente)',
    'Taxa de adesão ao tratamento (frequência média)',
    'Número de internações psiquiátricas evitadas (estimativa)',
    'Número de atendimentos individuais realizados mensalmente',
    'Número de grupos terapêuticos realizados mensalmente',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - PF (profissionais de saúde)', percentualMaximo: 0.60 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (medicamentos, insumos)', percentualMaximo: 0.15 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - PJ', percentualMaximo: 0.15 },
    { codigo: '3.3.90.47', descricao: 'Obrigações Tributárias', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'A entidade declara estar em dia com suas obrigações fiscais, trabalhistas e previdenciárias.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
    'A entidade declara que a equipe técnica possui registro nos respectivos conselhos profissionais.',
    'A entidade declara que as instalações atendem aos requisitos da RDC ANVISA 50/2002.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNS/MS para habilitação e custeio de Centro de Atenção Psicossocial (CAPS) na Rede de Atenção Psicossocial (RAPS). Referencie obrigatoriamente: Portaria GM/MS 3.088/2011 (institui a RAPS), Portaria 3.588/2017 (redefine CAPS e equipes mínimas), Lei 10.216/2001 (Reforma Psiquiátrica). Use terminologia SUS/RAPS: Projeto Terapêutico Singular (PTS), acolhimento, clínica ampliada, território, desinstitucionalização. A equipe mínima deve ser especificada conforme a modalidade CAPS escolhida (CAPS I: 11 profissionais; CAPS II: 13; CAPS III: 16 + noturno; CAPSad: 13; CAPSi: 11).`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. Deve ser revisado por profissional de saúde mental e gestor do SUS antes da submissão ao Transferegov. A habilitação do CAPS requer vistoria presencial do Ministério da Saúde. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
