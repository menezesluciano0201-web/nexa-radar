# NEXA RADAR — CLAUDE.md
# Plataforma de Inteligência de Subexecução e Recursos Públicos

---

## IDENTIDADE DA EMPRESA

**Nome:** Nexa Radar
**Missão:** Encontrar dinheiro público parado, estruturar sua execução e garantir que cada centavo vire impacto real — com rastreabilidade, prestação de contas e visibilidade política.
**Posicionamento:** Não fazemos projetos. Encontramos o dinheiro que ninguém está usando e transformamos em execução real.
**Tagline:** "O radar que nenhum gestor público deveria operar sem."

---

## O QUE A NEXA RADAR FAZ

A Nexa Radar opera em três camadas simultâneas:

1. **RASTREAMENTO** — Identifica verbas dormentes em todas as esferas (federal, estadual, municipal, fundos, emendas, editais privados)
2. **ESTRUTURAÇÃO** — Gera projetos aprovávais, faz o casamento entre parlamentar/prefeitura/OSCIP e remove gargalos de execução
3. **COMPLIANCE** — Coleta evidências de execução, gera relatórios auditados, submete aos sistemas do governo e publica no portal de transparência

---

## CLIENTES E SUAS DORES REAIS

### PREFEITO
**O que quer:** Aparecer trazendo recurso, proteger-se juridicamente, direcionar para sua base eleitoral
**Dores:** Não sabe o que está disponível, medo do TCU, equipe técnica fraca, prazo virando surpresa
**Como entrar:** Chegue com o relatório do município já pronto — "Você tem R$ X parado"
**Pitch:** "Prefeito, você tem acesso a R$ 5M e está usando R$ 800k. Eu monto o projeto, garanto a execução, a prestação de contas e coloco seu nome na entrega."
**Nunca diga:** "projeto" antes de mostrar o dinheiro perdido

### DEPUTADO FEDERAL
**O que quer:** Controle sobre as emendas, visibilidade eleitoral, OSC confiável para executar
**Dores:** Emenda empenhada que não sai do papel, risco de devolução vira notícia em 2026, não sabe o saldo real
**Como entrar:** Via assessor. Mostre o mapa de emendas dele com % de execução
**Pitch:** "Você tem R$ X parado em emendas que vencem em dezembro. Eu monitoro tudo, aciono as prefeituras e garanto que cada centavo vira entrega com seu nome."
**Momento certo:** Janeiro-Março e Setembro-Outubro

### SENADOR
**O que quer:** Visão estadual consolidada, comparativo com rivais, legado para governadoria
**Dores:** Base é o estado inteiro — impossível acompanhar, visibilidade diluída, responsabilidade da prestação de contas é dele
**Como entrar:** Abordagem formal com mapa estadual consolidado — nenhum assessor tem isso
**Pitch:** "Você tem emendas em X municípios do estado e estimo que 40% está subexecutado. Entrego monitoramento estadual completo e relatório de impacto por região."
**Diferencial:** Nunca trate como deputado — quer visão estratégica, não operacional

### OSCIP / OSC
**O que quer:** Projetos garantidos, previsibilidade financeira, ser encontrada por quem tem recurso
**Dores:** Mais tempo em burocracia que em projeto, sobrevivência depende de edital, não tem conexão política
**Como entrar:** No momento de renovação de convênio ou quando perdeu um edital
**Pitch:** "Você executa. Eu encontro o recurso, faço a ponte, estruturo o projeto e cuido da prestação de contas. Você aparece como quem entrega."
**Momento certo:** Fim de ano, quando editais fecham

---

## FONTES DE RECURSOS RASTREADAS

### FEDERAL
- **Transferegov** — convênios, instrumentos de transferência, emendas formalizadas
- **Portal da Transparência (API REST)** — transferências voluntárias, emendas parlamentares
- **FNAS (Fundo Nacional de Assistência Social)** — SCFV, IGD-SUAS, TEA, Proteção Social, BPC Escola, Criança Feliz
- **FNS (Fundo Nacional de Saúde)** — PAB Fixo/Variável, ESF, CAPS, Rede Cegonha, Vigilância
- **FNDE** — PNAE, PNATE, PDDE, Proinfância
- **SIGA Brasil (Senado — SPARQL)** — emendas individuais impositivas, bancada, comissão, relator
- **Câmara API (dados abertos)** — emendas por parlamentar

### ESTADUAL (AL / SE / PE)
- **FEAC / FEAS-AL** — Assistência Social Alagoas
- **FEAS-SE / FES-SE** — Saúde e Assistência Sergipe
- **FEAS-PE / FES-PE** — Pernambuco
- Scraping HTML dos portais de transparência estaduais

### PRIVADO
- Itaú Social, Fundação Lemann, Instituto Natura, BNDES Social, Fundação Vale
- Monitoramento de editais abertos com prazo e área temática

---

## MÓDULOS DO SISTEMA

### M1 — RADAR DE SUBEXECUÇÃO
Identifica programas com baixa execução cruzando por estado, município, fundo e área temática.
Output: "Prefeitura de X deixou R$ 2,3M parados no programa Y. Prazo: 15/12."

### M2 — DIAGNÓSTICO AUTOMÁTICO DE MUNICÍPIO
Input: nome da cidade.
Output: o que ela poderia captar, o que não está acessando, quais programas está habilitada, pitch pronto para o prefeito.

### M3 — GERADOR DE PROJETOS APROVÁVAIS
Templates: SCFV, TEA, CAPS, Idoso, Esporte, Saúde Básica, Educação.
IA gera: plano de trabalho, metas físicas, indicadores SUAS/SUS compatíveis, cronograma, orçamento.
Não é texto bonito — é texto que passa na análise federal.

### M4 — CASAMENTO EMENDA × OSCIP
Score de compatibilidade por: área temática, município de atuação, habilitação no Transferegov, histórico de execução, nota de desempenho.
IA recomenda: melhor OSCIP + argumento político para o parlamentar aceitar.

### M5 — INTELIGÊNCIA POLÍTICA
Mapeamento de alianças, oposições e posicionamento de governo por partido.
Score de risco de relacionamento: Baixo (abordagem direta), Médio (requer intermediário), Alto (requer estratégia de entrada).
Alerta: emenda de deputado PT em município PL = fricção. Sistema adverte.

### M6 — PRESTAÇÃO DE CONTAS COMO SERVIÇO
Fluxo completo:
1. Coleta de evidências (app mobile: foto + GPS + timestamp, frequência digital, relatos, NF via OCR)
2. Validação por IA (cruza geolocalização, detecta inconsistências antes de submeter)
3. Geração de relatório narrativo (compatível com Transferegov, TCU, CGU)
4. Submissão técnica (gestor clica em confirmar — 1 ação)
5. Publicação automática no portal de transparência municipal
6. Release de imprensa + post social para o parlamentar/prefeito

### M7 — PORTAL DE TRANSPARÊNCIA MUNICIPAL
Widget embeddável ou site gerado automaticamente.
Atualização automática a cada submissão aprovada.
Dashboard público com indicadores de impacto, fotos geolocalizadas, mapa de execução.

---

## MODELO DE NEGÓCIO

| Serviço | Valor |
|---|---|
| Diagnóstico municipal | R$ 5k–20k (único) |
| Estruturação de projeto | 5%–12% do valor captado |
| Gestão contínua (prefeito) | R$ 3k–15k/mês |
| Monitoramento parlamentar | R$ 6k–15k/mês por parlamentar |
| Prestação de Contas como Serviço | R$ 1,5k–9k/mês por programa |
| Licença de plataforma (OSCIPs) | R$ 2k–5k/mês |

Meta: R$ 75k+/mês recorrente com 15-20 clientes ativos.

---

## STACK TÉCNICA

### Backend / Dados
- Python 3.11+ com type hints obrigatório
- requests, pandas, BeautifulSoup4, lxml, openpyxl
- APIs: Portal Transparência (chave gratuita), SIGA Brasil (SPARQL), Transferegov, FNDE Dados Abertos, Câmara API
- Scraping HTML para portais estaduais e fundações privadas
- Agendador: cron job semanal para varredura regional

### IA
- Claude claude-sonnet-4-6 para todos os módulos de geração (override via env `CLAUDE_MODEL`)
- Prompts especializados por módulo (diagnóstico, projeto, pitch, briefing parlamentar, casamento, relatório)
- Sempre retornar JSON estruturado quando o output alimenta outro sistema

### Frontend
- React com hooks
- Tailwind CSS (somente utility classes base)
- Recharts para visualizações
- Design: dark theme + cor de acesso por módulo

### Arquivos e Outputs
- Relatórios em PDF (via reportlab ou weasyprint)
- Exportação Excel (openpyxl)
- Portal público em HTML estático gerado automaticamente

---

## REGRAS DE DESENVOLVIMENTO

- Nunca commitar chaves de API — usar .env sempre
- Todo scraping deve ter User-Agent identificado como "nexaradar-pesquisa-publica/1.0"
- Rate limiting obrigatório em todas as chamadas de API (mínimo 300ms entre requests)
- Dados de municípios indexados por código IBGE (não por nome)
- Toda geração de projeto deve incluir disclaimer: "revisar com especialista antes de submeter"
- Prestação de contas: gestor público mantém responsabilidade legal — sistema prepara, humano submete
- Nunca usar dados pessoais de beneficiários sem anonimização

---

## COMANDOS DO PROJETO

```bash
# Instalar dependências
pip install -r requirements.txt --break-system-packages

# Rodar varredura de municípios
python scraper_fontes.py

# Gerar diagnóstico de município específico
python diagnostico.py --municipio "Lagarto - SE"

# Iniciar dashboard
npm run dev

# Rodar testes
python -m pytest tests/ -v

# Exportar relatório PDF
python relatorio.py --municipio "Lagarto - SE" --output relatorios/
```

---

## ESTRUTURA DE DIRETÓRIOS

```
nexa-radar/
├── CLAUDE.md                  ← este arquivo
├── .env                       ← chaves de API (nunca commitar)
├── requirements.txt
├── scraper/
│   ├── portal_transparencia.py
│   ├── siga_brasil.py
│   ├── transferegov.py
│   ├── fnde.py
│   ├── portais_estaduais.py
│   └── fundacoes_privadas.py
├── ia/
│   ├── diagnostico.py         ← M2
│   ├── gerador_projetos.py    ← M3
│   ├── casamento_oscip.py     ← M4
│   ├── briefing_parlamentar.py← M5
│   └── relatorio_pc.py        ← M6
├── dashboard/
│   ├── src/
│   │   ├── RadarSubexecucao.jsx    ← M1
│   │   ├── DiagnosticoMunicipio.jsx← M2
│   │   ├── GeradorProjetos.jsx     ← M3
│   │   ├── InteligenciaPolitica.jsx← M4/M5
│   │   └── TransparenciaServico.jsx← M6/M7
│   └── package.json
├── templates/
│   ├── scfv.json
│   ├── tea.json
│   ├── caps.json
│   ├── idoso.json
│   └── esporte.json
├── dados/
│   ├── municipios_ibge.json
│   └── historico_subexecucao.csv
└── tests/
```

---

## CONTEXTO ESTRATÉGICO (ler antes de qualquer feature)

A Nexa Radar opera em um mercado onde:
- Bilhões de reais em verbas públicas voltam para a União todo ano por subexecução
- Prefeituras não têm capacidade técnica para monitorar e executar todos os programas
- Parlamentares têm emendas impositivas obrigatórias que não conseguem executar
- OSCIPs têm capacidade mas não têm acesso ao recurso ou à burocracia
- Nenhum concorrente usa IA e dados abertos para fazer esse trabalho de forma sistemática

O fosso competitivo da Nexa Radar está em três camadas:
1. **Dados proprietários** — histórico de execução e relacionamentos acumulado com o tempo
2. **Relacionamentos políticos** — confiança construída com gestores que não tiveram processo no TCU por causa da Nexa
3. **Custo de troca alto** — quem delega a prestação de contas não troca facilmente

A Nexa Radar não vende serviço. Vende **eliminação de risco** para quem tem poder político e **acesso a recurso** para quem tem capacidade de execução.
