import type { TemplateConfig } from '@/types'

export const educacao: TemplateConfig = {
  nome: 'Educação — Programas FNDE',
  orgao: 'MEC / FNDE',
  fundo: 'FNDE',
  camposEspecificos: [
    {
      nome: 'nivel',
      label: 'Nível de ensino',
      tipo: 'select',
      opcoes: ['educação infantil', 'ensino fundamental', 'ensino médio'],
      obrigatorio: true,
    },
    {
      nome: 'programa_fnde',
      label: 'Programa FNDE',
      tipo: 'select',
      opcoes: ['PNAE (Alimentação Escolar)', 'PDDE (Dinheiro Direto na Escola)', 'Proinfância (infraestrutura)'],
      obrigatorio: true,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto mencionando o programa FNDE escolhido, o nível de ensino, o número de alunos beneficiados e o município. Use a terminologia correta do programa.',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Para PNAE: apresente número de alunos matriculados, percentual que depende da alimentação escolar, situação de insegurança alimentar. Para PDDE: descreva necessidades de manutenção/aquisição e autonomia escolar. Para Proinfância: apresente déficit de vagas em creches/pré-escolas, demanda não atendida.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Para PNAE: descreva cardápio, fornecedores locais (30% da agricultura familiar), nutricionista responsável. Para PDDE: liste itens de manutenção/aquisição por escola. Para Proinfância: descreva projeto de construção/reforma, metragem, padrão construtivo FNDE.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva a rede de escolas municipais, equipe gestora do programa, sistema de controle (SIGPC/SIMEC) e histórico de prestação de contas anterior.',
    },
  ],
  indicadores: [
    'Número de alunos atendidos pelo programa',
    'Percentual de aquisição da agricultura familiar (PNAE: mínimo 30%)',
    'Número de escolas beneficiadas',
    'Taxa de execução financeira do programa (PDDE)',
  ],
  rubricas: [
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (gêneros alimentícios PNAE / material didático)', percentualMaximo: 0.60 },
    { codigo: '4.4.90.51', descricao: 'Obras e Instalações (Proinfância)', percentualMaximo: 0.70 },
    { codigo: '4.4.90.52', descricao: 'Equipamentos e Material Permanente', percentualMaximo: 0.25 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - PJ', percentualMaximo: 0.15 },
  ],
  declaracoesObrigatorias: [
    'O gestor municipal declara que o município está adimplente com o FNDE e com as prestações de contas anteriores.',
    'A entidade declara estar cadastrada no SIGPC/SIMEC e com dados atualizados.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
  ],
  promptInstrucoes: `Este projeto segue as normas do FNDE/MEC para programas educacionais. A submissão é via SIGPC (PDDE, Proinfância) ou SIMEC — não pelo Transferegov padrão. Adapte a linguagem ao programa escolhido: PNAE (Lei 11.947/2009, resolução FNDE vigente, nutricionista responsável, 30% agricultura familiar); PDDE (resolução FNDE CD nº 5/2020, unidade executora, conselho escolar); Proinfância (Resolução CD/FNDE 6/2012, projeto padrão FNDE tipo B/C/D). Use terminologia FNDE: unidade executora, entidade mantenedora, prestação de contas via SIGPC.`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. A submissão de programas FNDE é feita via SIGPC ou SIMEC, não pelo Transferegov. Revisar com gestor municipal de educação e secretaria de finanças antes de qualquer encaminhamento. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
