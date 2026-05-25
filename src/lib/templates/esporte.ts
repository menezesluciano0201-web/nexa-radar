import type { TemplateConfig } from '@/types'

export const esporte: TemplateConfig = {
  nome: 'Programa de Esporte e Lazer',
  orgao: 'ME (Ministério do Esporte)',
  fundo: 'Orçamento ME',
  camposEspecificos: [
    {
      nome: 'modalidades_esportivas',
      label: 'Modalidades esportivas',
      tipo: 'text',
      obrigatorio: true,
    },
    {
      nome: 'faixa_etaria_alvo',
      label: 'Faixa etária principal',
      tipo: 'select',
      opcoes: ['crianças (6-12)', 'adolescentes (13-17)', 'jovens (18-29)', 'adultos (30-59)', 'idosos (60+)', 'misto'],
      obrigatorio: true,
    },
    {
      nome: 'equipamentos_solicitados',
      label: 'Equipamentos esportivos solicitados (lista)',
      tipo: 'textarea',
      obrigatorio: false,
    },
  ],
  secoes: [
    {
      id: 'objeto',
      titulo: 'Objeto',
      obrigatoria: true,
      instrucoes: 'Descreva o objeto: modalidades esportivas, público-alvo, município e resultados esperados em termos de inclusão social pelo esporte.',
    },
    {
      id: 'justificativa',
      titulo: 'Justificativa',
      obrigatoria: true,
      instrucoes: 'Apresente dados de vulnerabilidade social, ausência de infraestrutura esportiva, e potencial do esporte como ferramenta de inclusão. Referencie o Programa Esporte e Lazer da Cidade (PELC) e a Lei Pelé (9.615/1998) quando aplicável.',
    },
    {
      id: 'plano_de_trabalho',
      titulo: 'Plano de Trabalho',
      obrigatoria: true,
      instrucoes: 'Liste atividades por modalidade: treinamentos semanais, torneios, eventos de inclusão. Inclua carga horária, professores/monitores e locais de prática. Descreva como os equipamentos serão usados.',
    },
    {
      id: 'capacidade_instalada',
      titulo: 'Capacidade Instalada',
      obrigatoria: true,
      instrucoes: 'Descreva infraestrutura disponível (quadras, campos, ginásios), equipe de professores/monitores com formação, e experiência prévia em projetos esportivos.',
    },
  ],
  indicadores: [
    'Número de participantes ativos mensalmente',
    'Número de modalidades esportivas ofertadas',
    'Número de eventos/torneios realizados',
    'Percentual de participantes em situação de vulnerabilidade social',
  ],
  rubricas: [
    { codigo: '3.3.90.36', descricao: 'Outros Serviços de Terceiros - PF (professores, monitores)', percentualMaximo: 0.45 },
    { codigo: '4.4.90.52', descricao: 'Equipamentos e Material Permanente (equipamentos esportivos)', percentualMaximo: 0.35 },
    { codigo: '3.3.90.30', descricao: 'Material de Consumo (material esportivo de consumo)', percentualMaximo: 0.10 },
    { codigo: '3.3.90.39', descricao: 'Outros Serviços de Terceiros - PJ', percentualMaximo: 0.10 },
  ],
  declaracoesObrigatorias: [
    'A entidade declara estar em dia com suas obrigações fiscais, trabalhistas e previdenciárias.',
    'A entidade declara não estar impedida de firmar convênio com a Administração Pública Federal.',
    'A entidade declara que os equipamentos adquiridos serão utilizados exclusivamente para os fins do objeto conveniado.',
  ],
  promptInstrucoes: `Este projeto segue as normas do Ministério do Esporte para convênios de esporte e lazer. Referencie o Programa Esporte e Lazer da Cidade (PELC), a Lei Pelé (9.615/1998) e, se aplicável, o Programa Segundo Tempo (PST). Use linguagem de inclusão social pelo esporte: territórios vulneráveis, democratização do acesso, esporte educacional vs. rendimento. Equipamentos devem ser justificados pelo número de beneficiários e modalidades.`,
  disclaimer: 'ATENÇÃO: Este documento foi gerado com apoio de inteligência artificial. Deve ser revisado por gestor municipal de esportes antes da submissão ao Transferegov. A responsabilidade legal é exclusivamente do gestor público signatário.',
}
