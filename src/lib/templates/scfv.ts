import type { TemplateConfig } from '@/types'

export const scfv: TemplateConfig = {
  nome: 'Serviço de Convivência e Fortalecimento de Vínculos (SCFV)',
  orgao: 'MDS / SUAS',
  fundo: 'FNAS',
  camposEspecificos: [
    {
      nome: 'faixas_etarias',
      label: 'Faixas etárias atendidas',
      tipo: 'multi-select',
      opcoes: ['criança (0-12)', 'adolescente (13-17)', 'idoso (60+)'],
      obrigatorio: true,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto do convênio de forma clara e objetiva, mencionando o serviço SCFV, o público-alvo e o município. Máximo 3 parágrafos.',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente dados sociais do município (vulnerabilidade, CRAS, CREAS) e justifique a necessidade do SCFV. Use linguagem SUAS. 4-6 parágrafos.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Liste atividades mensais do SCFV por faixa etária. Inclua facilitadores, carga horária semanal, metodologia socioeducativa. Formato narrativo, não tabela.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada da Proponente',
      obrigatoria: true,
      instrucoes: 'Descreva a estrutura física, equipe técnica e experiência prévia da entidade proponente na execução de serviços SUAS.',
    },
  ],
  indicadores: [
    'Número de usuários atendidos mensalmente',
    'Taxa de frequência dos usuários (mínimo 75%)',
    'Número de famílias com Plano de Acompanhamento Familiar (PAF)',
    'Percentual de usuários referenciados ao CRAS',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - Pessoa Física (facilitadores)', percentualMaximo: 0.50 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (material socioeducativo)', percentualMaximo: 0.20 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - Pessoa Jurídica', percentualMaximo: 0.20 },
    { codigo: '3.3.90.47', descricao: 'Obrigações Tributárias e Contributivas', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'A entidade declara estar em dia com suas obrigações fiscais, trabalhistas e previdenciárias.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
    'A entidade declara que as informações prestadas são verdadeiras e assume responsabilidade por sua veracidade.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNAS/MDS para o Serviço de Convivência e Fortalecimento de Vínculos (SCFV), regulamentado pela Resolução CNAS nº 1/2013 e Tipificação Nacional de Serviços Socioassistenciais. Use terminologia SUAS: usuários (não "beneficiários"), referenciamento, matricialidade sociofamiliar, CRAS, CREAS, PAF, frequência mínima de 75%. O plano de trabalho deve ser compatível com a Orientação Técnica SCFV do MDS. Metas físicas devem ser mensuráveis e compatíveis com a capacidade instalada declarada.`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial como ferramenta de apoio técnico. O conteúdo deve ser revisado por profissional habilitado do SUAS antes da submissão ao Transferegov. A responsabilidade legal pela veracidade das informações é exclusivamente do gestor público signatário.',
}
