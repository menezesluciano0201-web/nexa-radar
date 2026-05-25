import type { TemplateConfig } from '@/types'

export const idoso: TemplateConfig = {
  nome: 'Serviço de Proteção Social ao Idoso',
  orgao: 'MDS / SUAS',
  fundo: 'FNAS',
  camposEspecificos: [
    {
      nome: 'modalidade',
      label: 'Modalidade',
      tipo: 'select',
      opcoes: ['Centro-Dia', 'ILPI (Instituição de Longa Permanência)', 'Serviço Domiciliar'],
      obrigatorio: true,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto mencionando a modalidade (Centro-Dia, ILPI ou Domiciliar), faixa etária (60+), vulnerabilidade-alvo e município. Referencie o Estatuto do Idoso (Lei 10.741/2003).',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente dados demográficos de idosos no município (IBGE), demanda reprimida por serviços, situações de abandono ou vulnerabilidade. Referencie PNAS, NOB-SUAS e Política Nacional do Idoso.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Descreva atividades por modalidade: Centro-Dia (atividades socioeducativas, reabilitação, alimentação); ILPI (cuidados pessoais, saúde, convívio); Domiciliar (visitas, cuidados, fortalecimento familiar). Inclua equipe mínima conforme RDC ANVISA 283/2005 para ILPI.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva estrutura física acessível, equipe de cuidadores e técnicos, e experiência comprovada com idosos.',
    },
  ],
  indicadores: [
    'Número de idosos atendidos mensalmente',
    'Taxa de frequência (Centro-Dia: mínimo 75%)',
    'Número de famílias com Plano de Acompanhamento Familiar',
    'Percentual de idosos com avaliação multidimensional realizada',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - PF (cuidadores, profissionais)', percentualMaximo: 0.55 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (alimentação, higiene, insumos)', percentualMaximo: 0.20 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - PJ', percentualMaximo: 0.15 },
    { codigo: '3.3.90.47', descricao: 'Obrigações Tributárias', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'A entidade declara estar em dia com suas obrigações fiscais, trabalhistas e previdenciárias.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
    'A entidade declara que as instalações atendem ao Estatuto do Idoso (Lei 10.741/2003) e, quando aplicável, à RDC ANVISA 283/2005.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNAS/MDS para serviços de proteção social ao idoso, conforme Tipificação Nacional de Serviços Socioassistenciais (Resolução CNAS nº 109/2009) e Estatuto do Idoso (Lei 10.741/2003). Para ILPI: observe obrigatoriamente a RDC ANVISA 283/2005 (condições de funcionamento). Use terminologia SUAS: referenciamento, centralidade familiar, cuidado integrado. Idosos em ILPI devem ter Plano Individual de Atenção.`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. Deve ser revisado por profissional do SUAS antes da submissão ao Transferegov. Para ILPI, a operação exige licença sanitária da ANVISA/VISA municipal. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
