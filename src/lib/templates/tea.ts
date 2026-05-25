import type { TemplateConfig } from '@/types'

export const tea: TemplateConfig = {
  nome: 'Serviço de Proteção Social para Pessoas com Deficiência (TEA)',
  orgao: 'MDS / SUAS',
  fundo: 'FNAS',
  camposEspecificos: [
    {
      nome: 'tipo_atendimento',
      label: 'Tipo de atendimento',
      tipo: 'select',
      opcoes: ['centro-dia', 'domiciliar'],
      obrigatorio: true,
    },
    {
      nome: 'exige_laudo',
      label: 'Exige laudo diagnóstico (TEA/CID F84)',
      tipo: 'checkbox',
      obrigatorio: false,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto mencionando o serviço de proteção para pessoas com deficiência (TEA/CID F84), modalidade (centro-dia ou domiciliar), público-alvo e município.',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente dados epidemiológicos de TEA no município ou região, demanda reprimida, ausência de serviço equivalente. Referencie a Política Nacional de Saúde da Pessoa com Deficiência e a Lei Berenice Piana (nº 12.764/2012).',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Descreva as atividades especializadas: terapia ocupacional, fonoaudiologia, psicologia, suporte familiar. Inclua frequência semanal, equipe mínima (conforme Resolução CNAS nº 9/2013) e metodologia de acompanhamento individual.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva estrutura física acessível (ABNT NBR 9050), profissionais com habilitação em TEA, experiência prévia comprovada com pessoas com deficiência.',
    },
  ],
  indicadores: [
    'Número de pessoas com deficiência atendidas mensalmente',
    'Número de famílias com Plano Individual de Atendimento (PIA)',
    'Percentual de atendimentos realizados conforme cronograma',
    'Número de encaminhamentos para rede socioassistencial e de saúde',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - PF (terapeutas, cuidadores)', percentualMaximo: 0.55 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (insumos terapêuticos)', percentualMaximo: 0.15 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - PJ', percentualMaximo: 0.20 },
    { codigo: '3.3.90.47', descricao: 'Obrigações Tributárias', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'A entidade declara estar em dia com suas obrigações fiscais, trabalhistas e previdenciárias.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
    'A entidade declara possuir equipe técnica habilitada para atendimento especializado a pessoas com Transtorno do Espectro Autista.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNAS/MDS para serviços de proteção social especial para pessoas com deficiência, com foco em Transtorno do Espectro Autista (TEA/CID F84). Referencie a Lei Berenice Piana (12.764/2012), a Tipificação Nacional de Serviços Socioassistenciais e a Resolução CNAS nº 9/2013 (equipe de referência). Use linguagem SUAS: Plano Individual de Atendimento (PIA), referenciamento familiar, equipe interdisciplinar. Todos os serviços devem ser em espaço acessível (ABNT NBR 9050).`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. Deve ser revisado por profissional habilitado do SUAS e especialista em deficiência antes da submissão ao Transferegov. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
