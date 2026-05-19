
import { useState } from "react";

const FASES = [
  {
    id: "rastreamento",
    num: "01",
    label: "RASTREAMENTO",
    subtitulo: "Encontrar o dinheiro",
    icone: "📡",
    cor: "#0ea5e9",
    desc: "Tudo que você precisa para descobrir onde há verba parada, quem tem emenda não executada e quais programas estão subexecutados.",
    bases: [
      {
        nome: "Portal da Transparência — API REST",
        orgao: "CGU / Governo Federal",
        url: "portaldatransparencia.gov.br/api-de-dados",
        tipo: "API Pública",
        acesso: "Chave gratuita",
        como: "Cadastro online em 5 minutos no próprio portal",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "500 req/hora com chave gratuita",
        dados: ["Transferências voluntárias","Emendas parlamentares","Convênios","Programas sociais por município","Execução orçamentária"],
        critico: true,
        observacao: null,
      },
      {
        nome: "SIGA Brasil — SPARQL (Senado)",
        orgao: "Senado Federal",
        url: "www12.senado.leg.br/orcamento/sigabrasil",
        tipo: "Endpoint SPARQL Público",
        acesso: "Sem autenticação",
        como: "Acesso direto via HTTP — nenhum cadastro necessário",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite documentado",
        dados: ["Emendas individuais impositivas","Emendas de bancada","Emendas de comissão","Valores empenhados vs. pagos por município","Saldo residual por parlamentar"],
        critico: true,
        observacao: "Fonte mais valiosa para o módulo parlamentar — nenhum concorrente usa sistematicamente",
      },
      {
        nome: "Câmara dos Deputados — Dados Abertos",
        orgao: "Câmara Federal",
        url: "dadosabertos.camara.leg.br",
        tipo: "API REST Pública",
        acesso: "Sem autenticação",
        como: "Acesso direto",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Padrão REST",
        dados: ["Emendas por deputado","Votações","Dados de mandato","Coligações e partidos"],
        critico: false,
        observacao: null,
      },
      {
        nome: "Transferegov — Consulta Pública",
        orgao: "SEGES / Ministério da Gestão",
        url: "transferegov.sistema.gov.br",
        tipo: "API REST Pública (leitura)",
        acesso: "Sem autenticação para consulta",
        como: "Acesso direto para leitura; gov.br para operação",
        tempo: "Imediato (leitura) / 5 dias (operação)",
        custo: "Gratuito",
        limite: "Rate limit não documentado — aplicar 300ms entre requests",
        dados: ["Convênios em execução","Status de prestação de contas","Instrumentos de transferência","Planos de trabalho aprovados"],
        critico: true,
        observacao: "Para SUBMETER (não só ler) precisa de login gov.br do gestor",
      },
      {
        nome: "SIOP — Sistema Integrado de Planejamento",
        orgao: "SOF / Ministério do Planejamento",
        url: "siop.planejamento.gov.br",
        tipo: "Portal com dados abertos",
        acesso: "Parte pública, parte requer gov.br",
        como: "Scraping da parte pública; login gov.br para dados completos",
        tempo: "Imediato (público)",
        custo: "Gratuito",
        limite: "Scraping com respeito ao robots.txt",
        dados: ["Orçamento federal por função","Execução por órgão","Programas e ações orçamentárias"],
        critico: false,
        observacao: null,
      },
      {
        nome: "FNDE — Dados Abertos",
        orgao: "Fundo Nacional de Desenvolvimento da Educação",
        url: "fnde.gov.br/dadosabertos",
        tipo: "API e arquivos CSV/XML",
        acesso: "Público",
        como: "Download direto ou endpoint de dados abertos",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite",
        dados: ["Repasses PNAE por município","PNATE (transporte)","PDDE","Proinfância","BRASIL na Escola"],
        critico: true,
        observacao: null,
      },
      {
        nome: "DATASUS — Transferências SUS",
        orgao: "Ministério da Saúde",
        url: "datasus.saude.gov.br",
        tipo: "API + FTP público",
        acesso: "Público",
        como: "Tabnet para consulta; FTP para download massivo",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite no FTP",
        dados: ["PAB Fixo e Variável por município","ESF / ACS","Repasses Atenção Básica","Vigilância em Saúde","CAPS — credenciamentos"],
        critico: true,
        observacao: "Dados de saúde são a maior fonte de subexecução no Nordeste",
      },
      {
        nome: "Portais Estaduais — AL / SE / PE",
        orgao: "Governos Estaduais",
        url: "transparencia.al.gov.br | transparencia.se.gov.br | transparencia.pe.gov.br",
        tipo: "Scraping HTML",
        acesso: "Público",
        como: "Web scraping com User-Agent identificado",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Rate limiting manual — respeitar robots.txt",
        dados: ["Repasses estaduais para municípios","FEAC, FEAS, FES por estado","Convênios estaduais","Fundos setoriais estaduais"],
        critico: true,
        observacao: "Qualidade dos dados varia muito. AL e PE têm melhor estrutura que SE",
      },
      {
        nome: "IBGE — Malha Municipal e CNPJ IBGE",
        orgao: "IBGE",
        url: "servicodados.ibge.gov.br",
        tipo: "API REST Pública",
        acesso: "Público",
        como: "Acesso direto",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite",
        dados: ["Código IBGE por município","População estimada","Indicadores socioeconômicos","IDH municipal"],
        critico: true,
        observacao: "Código IBGE é o índice primário para cruzar todas as outras fontes",
      },
    ],
  },
  {
    id: "habilitacao",
    num: "02",
    label: "HABILITAÇÃO",
    subtitulo: "Credenciais para operar",
    icone: "🔐",
    cor: "#8b5cf6",
    desc: "Para além de consultar, você precisará de credenciais para operar nos sistemas em nome dos clientes ou como empresa credenciada.",
    bases: [
      {
        nome: "Gov.br — Conta Ouro (nível máximo)",
        orgao: "Governo Federal",
        url: "gov.br",
        tipo: "Identidade Digital",
        acesso: "Cadastro pessoal — biometria",
        como: "App gov.br + validação facial + documentos",
        tempo: "1–3 dias",
        custo: "Gratuito",
        limite: "Uma conta por CPF",
        dados: ["Acesso a todos os sistemas federais","Transferegov operacional","SIAFI (com perfil específico)","Plataforma +Brasil"],
        critico: true,
        observacao: "Você PRECISA ter conta Ouro. Conta prata ou bronze não acessa todos os módulos",
      },
      {
        nome: "Transferegov — Perfil de Gestor/Consultor",
        orgao: "SEGES",
        url: "transferegov.sistema.gov.br",
        tipo: "Perfil operacional",
        acesso: "Requer gov.br + vínculo com entidade",
        como: "O cliente (prefeitura/OSC) cadastra você como responsável técnico no sistema",
        tempo: "3–10 dias úteis",
        custo: "Gratuito",
        limite: "Por entidade cadastrada",
        dados: ["Submissão de planos de trabalho","Prestação de contas","Solicitação de liberação de parcela","Envio de relatórios de execução"],
        critico: true,
        observacao: "Você não acessa como pessoa jurídica — acessa com CPF vinculado à entidade do cliente",
      },
      {
        nome: "CNPJ da Nexa Radar — Ativo e Regular",
        orgao: "Receita Federal",
        url: "receita.fazenda.gov.br",
        tipo: "Registro empresarial",
        acesso: "Abertura de empresa",
        como: "Contador + Junta Comercial ou abertura MEI/SLU",
        tempo: "3–15 dias",
        custo: "R$ 0 (MEI) a R$ 500+ (LTDA)",
        limite: "N/A",
        dados: ["CNPJ ativo e sem restrições","Habilitado para prestação de serviços públicos","Base para contratos com prefeituras e OSCs"],
        critico: true,
        observacao: "Sem CNPJ regular você não assina contrato com prefeitura nem com parlamentar",
      },
      {
        nome: "CAUC — Cadastro de Inadimplência",
        orgao: "STN / Tesouro Nacional",
        url: "cauc.tesouro.gov.br",
        tipo: "Consulta de regularidade",
        acesso: "Público para consulta",
        como: "Consulta direta pelo CNPJ",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite",
        dados: ["Regularidade fiscal do município","Capacidade de receber transferências voluntárias","Certidões negativas em dia"],
        critico: true,
        observacao: "Você consulta o CAUC dos seus CLIENTES para saber se podem receber recurso — não o seu",
      },
      {
        nome: "SICONF / CADIN — Regularidade",
        orgao: "STN",
        url: "siconfi.tesouro.gov.br",
        tipo: "Consulta pública",
        acesso: "Público",
        como: "Consulta por CNPJ/CPF",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite",
        dados: ["Inadimplência do ente federativo","Bloqueio para recebimento de transferências","Situação fiscal do município"],
        critico: true,
        observacao: null,
      },
    ],
  },
  {
    id: "estruturacao",
    num: "03",
    label: "ESTRUTURAÇÃO",
    subtitulo: "Construir os projetos",
    icone: "📋",
    cor: "#f59e0b",
    desc: "Sistemas e bases que alimentam a elaboração dos projetos e planos de trabalho com dados reais e compatíveis com os exigidos pelos órgãos.",
    bases: [
      {
        nome: "REDE SUAS — Sistema de Gestão SUAS",
        orgao: "MDS / Ministério do Desenvolvimento Social",
        url: "redesuas.mds.gov.br",
        tipo: "Sistema com dados públicos + restrito",
        acesso: "Parte pública; operação requer vínculo com CRAS/CREAS",
        como: "Consulta pública via portal; operação via secretaria municipal",
        tempo: "Imediato (consulta)",
        custo: "Gratuito",
        limite: "Acesso operacional via gestor municipal",
        dados: ["Cadastro de serviços SUAS por município","Cobertura do SCFV","Famílias em vulnerabilidade","IGD — Índice de Gestão Descentralizada"],
        critico: true,
        observacao: "Fundamental para justificar projetos de assistência social com dados reais",
      },
      {
        nome: "CNIS — Cadastro Nacional de Entidades",
        orgao: "MDS",
        url: "mds.gov.br/cnis",
        tipo: "Cadastro público de OSCs",
        acesso: "Consulta pública",
        como: "Busca por CNPJ ou razão social",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite",
        dados: ["Habilitação de OSCs para SUAS","Certificações vigentes","Histórico de parcerias","Regularidade cadastral"],
        critico: true,
        observacao: "Você consulta aqui se uma OSCIP está habilitada para o programa antes de propor o casamento",
      },
      {
        nome: "CEBAS — Certificação de Entidades Beneficentes",
        orgao: "MDS / MEC / MS",
        url: "mds.gov.br/cebas",
        tipo: "Certificação",
        acesso: "Consulta pública",
        como: "Busca por CNPJ",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite",
        dados: ["OSCs com isenção fiscal","Certificação por área (social, saúde, educação)","Validade do certificado"],
        critico: false,
        observacao: "Importante para OSCIPs que acessam programas com contrapartida de isenção",
      },
      {
        nome: "e-Social / RAIS / CAGED",
        orgao: "MTE / Receita Federal",
        url: "esocial.gov.br",
        tipo: "Dados de emprego",
        acesso: "Público (RAIS/CAGED) / Restrito (e-Social)",
        como: "Download de microdados públicos",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Microdados com defasagem",
        dados: ["Empregados formais por município","Setor de atividade","Base para dimensionar metas de projeto"],
        critico: false,
        observacao: "Útil para justificativas econômicas em projetos de capacitação",
      },
      {
        nome: "SIOPS — Sistema de Informações sobre Orçamentos em Saúde",
        orgao: "Ministério da Saúde",
        url: "siops.datasus.gov.br",
        tipo: "Sistema com dados públicos",
        acesso: "Consulta pública",
        como: "Relatórios públicos por município",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite",
        dados: ["Gastos municipais em saúde","% do orçamento aplicado em saúde","Execução de programas FNS","Base para projetos e prestação de contas em saúde"],
        critico: true,
        observacao: null,
      },
    ],
  },
  {
    id: "execucao",
    num: "04",
    label: "EXECUÇÃO",
    subtitulo: "Acompanhar e registrar",
    icone: "⚙️",
    cor: "#10b981",
    desc: "Sistemas que a prefeitura/OSC usa durante a execução do projeto e onde você precisará registrar ou consultar o andamento.",
    bases: [
      {
        nome: "Transferegov — Módulo Execução",
        orgao: "SEGES",
        url: "transferegov.sistema.gov.br",
        tipo: "Sistema operacional",
        acesso: "Gov.br + perfil vinculado à entidade",
        como: "O gestor municipal/OSC dá acesso ao técnico da Nexa Radar",
        tempo: "Depende do cliente",
        custo: "Gratuito",
        limite: "Por entidade",
        dados: ["Solicitação de liberação de parcela","Registro de execução financeira","Envio de relatórios intermediários","Comprovantes de despesa"],
        critico: true,
        observacao: null,
      },
      {
        nome: "SIAFI Web — Execução Financeira",
        orgao: "STN / SERPRO",
        url: "siafi.tesouro.gov.br",
        tipo: "Sistema restrito federal",
        acesso: "Requer senha SIAFI — emitida para servidores ou terceirizados autorizados",
        como: "Somente via gestor público autorizado. Você NÃO acessa diretamente — o gestor acessa e você orienta",
        tempo: "N/A para você",
        custo: "Gratuito",
        limite: "Acesso por CPF autorizado",
        dados: ["Empenho","Liquidação","Pagamento","Nota de sistema","Execução orçamentária federal"],
        critico: false,
        observacao: "⚠ Você não acessa o SIAFI — você orienta o gestor que tem acesso. Importante saber ler os documentos.",
      },
      {
        nome: "SIGPC — Sistema de Gestão de Prestação de Contas (FNDE)",
        orgao: "FNDE",
        url: "sigpc.fnde.gov.br",
        tipo: "Sistema operacional FNDE",
        acesso: "Gov.br + vínculo com entidade (UEX ou prefeitura)",
        como: "Acesso via gestor da unidade executora escolar ou secretaria de educação",
        tempo: "5–15 dias",
        custo: "Gratuito",
        limite: "Por entidade",
        dados: ["Execução PNAE","Execução PDDE","Prestação de contas educação","Planos de ação FNDE"],
        critico: true,
        observacao: "Necessário para clientes com programas educacionais do FNDE",
      },
      {
        nome: "Plataforma +BRASIL (SICONV legado)",
        orgao: "SEGES",
        url: "plataformamaisbrasil.gov.br",
        tipo: "Sistema operacional (convênios antigos)",
        acesso: "Gov.br",
        como: "Acesso via gestor com perfil de convenente",
        tempo: "Imediato com gov.br",
        custo: "Gratuito",
        limite: "Por entidade",
        dados: ["Convênios celebrados antes de 2023","Prestações de contas em aberto","Saldos residuais de convênios antigos"],
        critico: true,
        observacao: "Muitos convênios antigos ainda estão aqui — não ignore essa fonte",
      },
    ],
  },
  {
    id: "prestacao",
    num: "05",
    label: "PRESTAÇÃO DE CONTAS",
    subtitulo: "Comprovar e submeter",
    icone: "📊",
    cor: "#dc2626",
    desc: "Sistemas onde a execução precisa ser comprovada, relatórios submetidos e aprovados pelos órgãos repassadores e de controle.",
    bases: [
      {
        nome: "Transferegov — Módulo Prestação de Contas",
        orgao: "SEGES",
        url: "transferegov.sistema.gov.br",
        tipo: "Sistema operacional",
        acesso: "Gov.br + perfil convenente",
        como: "O técnico da Nexa prepara tudo; o gestor revisa e clica em submeter",
        tempo: "Depende do cliente",
        custo: "Gratuito",
        limite: "Por entidade",
        dados: ["Envio de relatório de execução físico-financeiro","Anexo de notas fiscais e comprovantes","Fotos e evidências de execução","Solicitação de aprovação de parcela"],
        critico: true,
        observacao: "Este é o coração do M6 — Prestação de Contas como Serviço",
      },
      {
        nome: "TCE-AL / TCE-SE / TCE-PE — Portais",
        orgao: "Tribunais de Contas Estaduais",
        url: "tce.al.gov.br | tce.se.gov.br | tce.pe.gov.br",
        tipo: "Portais de controle externo",
        acesso: "Consulta pública + envio requer credencial do gestor",
        como: "Consulta de alertas e pendências dos clientes via portal público",
        tempo: "Imediato (consulta)",
        custo: "Gratuito",
        limite: "Sem limite (consulta)",
        dados: ["Pendências do município","Alertas de irregularidade","Histórico de prestações de contas","Municípios com gestão em dia"],
        critico: true,
        observacao: "Consulte ANTES de fechar contrato — se o município tem pendência grave no TCE, o risco é alto",
      },
      {
        nome: "CGU — Controladoria-Geral da União",
        orgao: "CGU",
        url: "portaldatransparencia.gov.br/cadastro",
        tipo: "Consulta pública + envio restrito",
        acesso: "Consulta pública; notificações via gestor",
        como: "Consulta de irregularidades e pendências de convênios",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite",
        dados: ["Entidades com irregularidades","Convênios com pendências CGU","Sanções a OSCs e gestores","CEIS — empresas e pessoas sancionadas"],
        critico: true,
        observacao: "Consulte CNPJ de toda OSCIP parceira aqui antes de fechar casamento",
      },
      {
        nome: "CEIS / CNEP / CEPIM — Cadastros de Sanções",
        orgao: "CGU",
        url: "cadastros.cgu.gov.br",
        tipo: "Base pública de sanções",
        acesso: "Público",
        como: "Consulta por CNPJ ou CPF",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "Sem limite",
        dados: ["Empresas inidôneas (CEIS)","Pessoas físicas sancionadas (CNEP)","Entidades impedidas de convênio (CEPIM)"],
        critico: true,
        observacao: "⚠ OBRIGATÓRIO consultar antes de qualquer parceria ou indicação de OSCIP",
      },
      {
        nome: "SIOPS — Prestação de Contas Saúde",
        orgao: "MS",
        url: "siops.datasus.gov.br",
        tipo: "Sistema operacional",
        acesso: "Gov.br + perfil de gestor municipal de saúde",
        como: "Via secretaria municipal de saúde",
        tempo: "Depende do cliente",
        custo: "Gratuito",
        limite: "Por entidade",
        dados: ["Envio de relatório de gestão saúde","Aplicação mínima em saúde","Prestação de contas FNS"],
        critico: true,
        observacao: null,
      },
    ],
  },
  {
    id: "transparencia",
    num: "06",
    label: "TRANSPARÊNCIA",
    subtitulo: "Publicar e comprovar",
    icone: "🌐",
    cor: "#0284c7",
    desc: "Onde o resultado final precisa ser publicado para cumprir a Lei de Acesso à Informação e gerar visibilidade política para o cliente.",
    bases: [
      {
        nome: "Portal Transparência Municipal (LAI)",
        orgao: "Prefeitura Municipal",
        url: "Domínio próprio da prefeitura",
        tipo: "Site da prefeitura — você gerencia",
        acesso: "Credencial de admin fornecida pelo cliente",
        como: "A prefeitura dá acesso ao CMS ou você implanta o widget da Nexa Radar",
        tempo: "Depende do cliente",
        custo: "Incluso no serviço",
        limite: "N/A",
        dados: ["Publicação de convênios","Relatórios de execução","Prestações de contas aprovadas","Indicadores de impacto"],
        critico: true,
        observacao: "Lei 131/2009 e LAI exigem publicação ativa. Muitos municípios estão em descumprimento — isso é uma oportunidade",
      },
      {
        nome: "Diário Oficial do Município",
        orgao: "Prefeitura Municipal",
        url: "Varies por município",
        tipo: "Publicação oficial",
        acesso: "Via assessoria jurídica do cliente",
        como: "Contrato com a Nexa deve ser publicado no DOM",
        tempo: "1–5 dias úteis",
        custo: "Gratuito ou taxa municipal",
        limite: "N/A",
        dados: ["Publicação de contratos","Atos de convênio","Aditivos e apostilamentos"],
        critico: true,
        observacao: "Sem publicação no DOM o contrato com você pode ser questionado",
      },
      {
        nome: "Portal Transparência Federal — Visualização",
        orgao: "CGU",
        url: "portaldatransparencia.gov.br",
        tipo: "Leitura/verificação pública",
        acesso: "Público",
        como: "Verificar se a submissão do cliente apareceu corretamente",
        tempo: "24–72h após submissão no Transferegov",
        custo: "Gratuito",
        limite: "Sem limite",
        dados: ["Confirmação de publicação da prestação","Visibilidade pública do convênio","Verificação de status"],
        critico: false,
        observacao: null,
      },
      {
        nome: "Redes Sociais do Parlamentar / Prefeito",
        orgao: "Cliente",
        url: "Instagram, Facebook, YouTube",
        tipo: "Publicação de impacto político",
        acesso: "Credencial fornecida pelo cliente ou conteúdo entregue para eles publicarem",
        como: "IA gera post + foto + legenda. Cliente publica ou autoriza publicação",
        tempo: "Imediato",
        custo: "Gratuito",
        limite: "N/A",
        dados: ["Post de inauguração","Foto com beneficiários (com autorização)","Infográfico de impacto","Release para imprensa local"],
        critico: false,
        observacao: "Esse é o entregável que o político mais valoriza — a visibilidade",
      },
    ],
  },
  {
    id: "privado",
    num: "07",
    label: "PRIVADO / EDITAIS",
    subtitulo: "Fontes não governamentais",
    icone: "🏆",
    cor: "#7c3aed",
    desc: "Fundações privadas e entidades que financiam projetos sociais. Exigem estruturação diferente — mais narrativa de impacto, menos burocracia federal.",
    bases: [
      {
        nome: "Itaú Social — Sistema de Inscrição",
        orgao: "Itaú Unibanco",
        url: "itausocial.org.br",
        tipo: "Portal de editais privados",
        acesso: "Cadastro da OSC como proponente",
        como: "Cadastro online da OSC + documentação institucional",
        tempo: "1–3 dias",
        custo: "Gratuito",
        limite: "Por edital",
        dados: ["Editais abertos","Critérios de seleção","Formulários de inscrição","Relatórios de prestação (simplificados)"],
        critico: false,
        observacao: "Foco em educação e primeira infância — perfil específico de OSC",
      },
      {
        nome: "Fundação Lemann — Plataforma",
        orgao: "Fundação Lemann",
        url: "fundacaolemann.org.br",
        tipo: "Portal de editais privados",
        acesso: "Cadastro + carta de intenção",
        como: "Via site + relacionamento direto",
        tempo: "Semanas (processo seletivo)",
        custo: "Gratuito",
        limite: "Por ciclo de seleção",
        dados: ["Editais educação","Formação de liderança","Bolsas e fellowships"],
        critico: false,
        observacao: null,
      },
      {
        nome: "BNDES — Fundo Social / FEP",
        orgao: "BNDES",
        url: "bndes.gov.br/editais",
        tipo: "Editais de subvenção",
        acesso: "Cadastro como proponente",
        como: "Plataforma BNDES + CNPJ regular + documentação",
        tempo: "Semanas (processo formal)",
        custo: "Gratuito",
        limite: "Por edital",
        dados: ["Projetos de desenvolvimento social","Cultura","Saúde comunitária","Meio ambiente"],
        critico: false,
        observacao: "Exige nível de estruturação mais alto — muito subutilizado por OSCs do Nordeste",
      },
      {
        nome: "Conecta Transformação (ex-Natura/Avon)",
        orgao: "Natura &Co",
        url: "conectatransformacao.com.br",
        tipo: "Plataforma de editais ESG",
        acesso: "Cadastro de OSC",
        como: "Plataforma digital",
        tempo: "1–5 dias",
        custo: "Gratuito",
        limite: "Por ciclo",
        dados: ["Editais ESG empresariais","Capacitação","Impacto socioambiental"],
        critico: false,
        observacao: null,
      },
    ],
  },
];

const TIPO_CORES = {
  "API Pública": "#10b981",
  "API REST Pública": "#10b981",
  "Endpoint SPARQL Público": "#10b981",
  "Scraping HTML": "#f59e0b",
  "Sistema operacional": "#0ea5e9",
  "Cadastro público de OSCs": "#8b5cf6",
  "Certificação": "#8b5cf6",
  "Portal de editais privados": "#7c3aed",
  "Consulta pública": "#64748b",
  "Portal com dados abertos": "#10b981",
  "Identidade Digital": "#dc2626",
  "Registro empresarial": "#dc2626",
  "Base pública de sanções": "#dc2626",
  "API e arquivos CSV/XML": "#10b981",
  "API + FTP público": "#10b981",
  "Leitura/verificação pública": "#64748b",
  "Site da prefeitura — você gerencia": "#0284c7",
  "Publicação oficial": "#0284c7",
  "Publicação de impacto político": "#7c3aed",
  "Sistema com dados públicos": "#f59e0b",
  "Sistema com dados públicos + restrito": "#f59e0b",
  "Sistema restrito federal": "#ef4444",
  "Editais de subvenção": "#7c3aed",
  "Plataforma de editais ESG": "#7c3aed",
};

const CUSTO_COR = {
  "Gratuito": "#10b981",
  "R$ 0 (MEI) a R$ 500+ (LTDA)": "#f59e0b",
};

export default function MapaBases() {
  const [faseSel, setFaseSel] = useState("rastreamento");
  const [baseSel, setBaseSel] = useState(null);
  const [filtro, setFiltro] = useState("todos");

  const fase = FASES.find(f => f.id === faseSel);
  const totalBases = FASES.reduce((a, f) => a + f.bases.length, 0);
  const totalCriticas = FASES.reduce((a, f) => a + f.bases.filter(b => b.critico).length, 0);

  const basesFiltradas = fase.bases.filter(b => {
    if (filtro === "critico") return b.critico;
    if (filtro === "gratuito") return b.custo === "Gratuito";
    return true;
  });

  return (
    <div style={{
      fontFamily:"'DM Sans','Segoe UI',sans-serif",
      background:"#06090f",
      minHeight:"100vh",
      color:"#e2e8f0",
    }}>

      {/* HEADER */}
      <div style={{
        background:"linear-gradient(135deg,#0b1427,#111e38)",
        padding:"22px 32px",
        borderBottom:"2px solid #1e3558",
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <span style={{fontSize:11,background:"#f59e0b",color:"#000",borderRadius:4,padding:"2px 8px",fontWeight:900,letterSpacing:2}}>NEXA RADAR</span>
              <span style={{fontSize:16,fontWeight:800,color:"#f8fafc"}}>Mapa de Acessos e Bases</span>
            </div>
            <div style={{fontSize:11,color:"#475569",letterSpacing:2}}>
              DO RASTREAMENTO À TRANSPARÊNCIA — TODAS AS FONTES NECESSÁRIAS
            </div>
          </div>
          <div style={{display:"flex",gap:20}}>
            {[
              {l:"TOTAL DE BASES",v:totalBases,c:"#e2e8f0"},
              {l:"CRÍTICAS",v:totalCriticas,c:"#f59e0b"},
              {l:"GRATUITAS",v:totalBases - 2,c:"#10b981"},
              {l:"PAGAS",v:2,c:"#ef4444"},
            ].map((k,i)=>(
              <div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:8,color:"#475569",letterSpacing:2}}>{k.l}</div>
                <div style={{fontSize:20,fontWeight:900,color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FASE TABS */}
      <div style={{
        background:"#080c16",
        borderBottom:"1px solid #1a2a40",
        display:"flex",padding:"0 32px",
        overflowX:"auto",gap:0,
      }}>
        {FASES.map(f=>(
          <button key={f.id} onClick={()=>{ setFaseSel(f.id); setBaseSel(null); }}
            style={{
              background:"transparent",border:"none",
              borderBottom:faseSel===f.id?`3px solid ${f.cor}`:"3px solid transparent",
              color:faseSel===f.id?f.cor:"#475569",
              padding:"12px 18px",cursor:"pointer",fontFamily:"inherit",
              fontSize:11,fontWeight:faseSel===f.id?700:400,
              whiteSpace:"nowrap",marginBottom:-1,transition:"all 0.15s",
            }}>
            {f.icone} {f.label}
            <span style={{
              marginLeft:6,fontSize:9,
              background:faseSel===f.id?f.cor+"30":"#1a2a40",
              border:`1px solid ${faseSel===f.id?f.cor:"#2a3a50"}`,
              borderRadius:10,padding:"1px 5px",color:faseSel===f.id?f.cor:"#475569",
            }}>{f.bases.length}</span>
          </button>
        ))}
      </div>

      <div style={{padding:"22px 32px",maxWidth:1120,margin:"0 auto"}}>

        {/* Fase header */}
        <div style={{
          background:fase.cor+"10",border:`1px solid ${fase.cor}33`,
          borderLeft:`4px solid ${fase.cor}`,borderRadius:10,
          padding:"14px 18px",marginBottom:18,
          display:"flex",justifyContent:"space-between",alignItems:"center",
        }}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:3}}>
              {fase.icone} Fase {fase.num} — {fase.label}: {fase.subtitulo}
            </div>
            <div style={{fontSize:11,color:"#64748b"}}>{fase.desc}</div>
          </div>
          <div style={{display:"flex",gap:8,flexShrink:0,marginLeft:20}}>
            {["todos","critico","gratuito"].map(f=>(
              <button key={f} onClick={()=>setFiltro(f)}
                style={{
                  background:filtro===f?fase.cor+"20":"transparent",
                  border:`1px solid ${filtro===f?fase.cor:"#2a3a50"}`,
                  borderRadius:4,color:filtro===f?fase.cor:"#475569",
                  fontFamily:"inherit",fontSize:9,padding:"4px 10px",
                  cursor:"pointer",fontWeight:filtro===f?700:400,letterSpacing:1,
                }}>
                {f==="todos"?"TODOS":f==="critico"?"⭐ CRÍTICOS":"💚 GRATUITOS"}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de bases */}
        {!baseSel ? (
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
            {basesFiltradas.map((base,i)=>(
              <div key={i} onClick={()=>setBaseSel(base)}
                style={{
                  background:"#0c1628",
                  border:`1px solid ${base.critico?"#f59e0b33":"#1a2a40"}`,
                  borderLeft:`3px solid ${base.critico?fase.cor:"#2a3a50"}`,
                  borderRadius:10,padding:"16px 18px",cursor:"pointer",
                  transition:"all 0.15s",
                }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#d0e4f8",flex:1,paddingRight:10}}>{base.nome}</div>
                  <div style={{display:"flex",gap:6,flexShrink:0,flexDirection:"column",alignItems:"flex-end"}}>
                    {base.critico && (
                      <span style={{fontSize:8,background:"#f59e0b20",border:"1px solid #f59e0b44",
                        borderRadius:3,padding:"1px 6px",color:"#f59e0b",fontWeight:700,letterSpacing:1}}>
                        ⭐ CRÍTICO
                      </span>
                    )}
                    <span style={{
                      fontSize:8,background:(TIPO_CORES[base.tipo]||"#475569")+"18",
                      border:`1px solid ${(TIPO_CORES[base.tipo]||"#475569")}44`,
                      borderRadius:3,padding:"1px 6px",
                      color:TIPO_CORES[base.tipo]||"#475569",fontWeight:600,
                    }}>{base.tipo}</span>
                  </div>
                </div>
                <div style={{fontSize:10,color:"#475569",marginBottom:8}}>{base.orgao}</div>
                <div style={{display:"flex",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                  <span style={{
                    fontSize:9,background:"#10b98115",border:"1px solid #10b98133",
                    borderRadius:3,padding:"1px 7px",color:"#10b981",
                  }}>{base.acesso}</span>
                  <span style={{
                    fontSize:9,
                    background:base.custo==="Gratuito"?"#10b98115":"#f59e0b15",
                    border:`1px solid ${base.custo==="Gratuito"?"#10b98133":"#f59e0b33"}`,
                    borderRadius:3,padding:"1px 7px",
                    color:base.custo==="Gratuito"?"#10b981":"#f59e0b",
                  }}>💰 {base.custo}</span>
                  <span style={{fontSize:9,background:"#1a2a40",border:"1px solid #2a3a50",
                    borderRadius:3,padding:"1px 7px",color:"#64748b"}}>
                    ⏱ {base.tempo}
                  </span>
                </div>
                {base.observacao && (
                  <div style={{fontSize:10,color:"#7a9ec0",background:"#0a1625",
                    borderRadius:4,padding:"5px 8px",fontStyle:"italic"}}>
                    💡 {base.observacao}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <button onClick={()=>setBaseSel(null)}
              style={{background:"transparent",border:"1px solid #1a2a40",borderRadius:4,
                color:"#475569",fontFamily:"inherit",fontSize:10,padding:"6px 14px",
                cursor:"pointer",marginBottom:16,letterSpacing:1}}>
              ← VOLTAR
            </button>
            <div style={{
              background:"#0c1628",border:`1px solid ${fase.cor}44`,
              borderTop:`4px solid ${fase.cor}`,borderRadius:12,padding:24,
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{fontSize:17,fontWeight:800,color:"#e8f4ff",marginBottom:4}}>{baseSel.nome}</div>
                  <div style={{fontSize:11,color:"#475569"}}>{baseSel.orgao}</div>
                </div>
                <div style={{display:"flex",gap:8,flexDirection:"column",alignItems:"flex-end"}}>
                  {baseSel.critico && <span style={{fontSize:9,background:"#f59e0b20",border:"1px solid #f59e0b44",borderRadius:3,padding:"2px 8px",color:"#f59e0b",fontWeight:700}}>⭐ CRÍTICO</span>}
                  <span style={{fontSize:9,background:(TIPO_CORES[baseSel.tipo]||"#475569")+"18",border:`1px solid ${(TIPO_CORES[baseSel.tipo]||"#475569")}44`,borderRadius:3,padding:"2px 8px",color:TIPO_CORES[baseSel.tipo]||"#475569"}}>{baseSel.tipo}</span>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
                {[
                  ["URL / Portal", baseSel.url],
                  ["Acesso", baseSel.acesso],
                  ["Como Obter", baseSel.como],
                  ["Tempo", baseSel.tempo],
                  ["Custo", baseSel.custo],
                  ["Limite", baseSel.limite],
                ].map(([k,v],i)=>(
                  <div key={i} style={{background:"#080c18",borderRadius:8,padding:"12px 14px",border:"1px solid #1a2a40"}}>
                    <div style={{fontSize:9,color:"#475569",letterSpacing:1,marginBottom:5,fontWeight:700}}>{k.toUpperCase()}</div>
                    <div style={{fontSize:11,color:"#a0c0e0",lineHeight:1.5}}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:"#475569",letterSpacing:1,fontWeight:700,marginBottom:10}}>DADOS DISPONÍVEIS</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {baseSel.dados.map((d,i)=>(
                    <span key={i} style={{
                      fontSize:10,background:fase.cor+"15",
                      border:`1px solid ${fase.cor}33`,borderRadius:4,
                      padding:"3px 10px",color:fase.cor,
                    }}>{d}</span>
                  ))}
                </div>
              </div>

              {baseSel.observacao && (
                <div style={{
                  background:"#0a1a2e",border:`1px solid ${fase.cor}33`,
                  borderLeft:`3px solid ${fase.cor}`,borderRadius:8,
                  padding:"12px 16px",fontSize:12,color:"#7ab0d8",fontStyle:"italic",lineHeight:1.7,
                }}>
                  💡 {baseSel.observacao}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#06090f;}
        ::-webkit-scrollbar-thumb{background:#1a2a40;border-radius:4px;}
        button:hover{opacity:0.88;}
        div[style*="cursor: pointer"]:hover{filter:brightness(1.07);}
      `}</style>
    </div>
  );
}
