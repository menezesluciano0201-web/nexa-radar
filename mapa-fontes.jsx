
import { useState } from "react";

const EIXOS = [
  {
    id: "assistencia",
    label: "ASSISTÊNCIA SOCIAL",
    icon: "🤝",
    cor: "#7c3aed",
    descricao: "Fontes SUAS / FNAS",
    volume: "R$ 4,2B/ano",
    fontes: [
      {
        nome: "FNAS — Fundo a Fundo",
        tipo: "FEDERAL",
        api: "API REST",
        url: "portaldatransparencia.gov.br",
        auth: "Chave gratuita",
        status: "RASTREÁVEL",
        programas: ["SCFV", "IGD-SUAS", "Proteção Social Básica", "Proteção Especial"],
        dormencia: "Alta — municípios pequenos executam menos de 40%",
        prazo: "Dezembro (exercício corrente)",
        dificuldade: "Baixa",
      },
      {
        nome: "TEA — Autismo / FNAS",
        tipo: "FEDERAL",
        api: "Transferegov",
        url: "transferegov.sistema.gov.br",
        auth: "Sem auth (leitura)",
        status: "RASTREÁVEL",
        programas: ["Apoio à Pessoa com TEA", "Acessibilidade SUAS"],
        dormencia: "Muito Alta — linha nova, municípios não captaram",
        prazo: "Ciclo anual",
        dificuldade: "Baixa",
      },
      {
        nome: "BPC na Escola",
        tipo: "FEDERAL",
        api: "Transferegov + MEC",
        url: "sisbenscolar.mec.gov.br",
        auth: "Acesso público",
        status: "RASTREÁVEL",
        programas: ["Benefício de Prestação Continuada na Escola"],
        dormencia: "Alta — habilitação técnica frequentemente ausente",
        prazo: "Fluxo contínuo",
        dificuldade: "Média",
      },
      {
        nome: "Programa Criança Feliz",
        tipo: "FEDERAL",
        api: "Transferegov",
        url: "transferegov.sistema.gov.br",
        auth: "Sem auth",
        status: "RASTREÁVEL",
        programas: ["Primeira Infância", "Visitação Domiciliar"],
        dormencia: "Média — requer cadastro técnico",
        prazo: "Anual",
        dificuldade: "Média",
      },
    ],
  },
  {
    id: "saude",
    label: "SAÚDE",
    icon: "🏥",
    cor: "#059669",
    descricao: "Blocos FNS / SUS",
    volume: "R$ 12,8B/ano",
    fontes: [
      {
        nome: "FNS — Atenção Básica",
        tipo: "FEDERAL",
        api: "API FNS / Portal Transparência",
        url: "datasus.saude.gov.br",
        auth: "Público",
        status: "RASTREÁVEL",
        programas: ["PAB Fixo", "PAB Variável", "ESF", "ACS"],
        dormencia: "Média — irregular em municípios com ESF desatualizado",
        prazo: "Mensal (competência)",
        dificuldade: "Média",
      },
      {
        nome: "CAPS — Saúde Mental",
        tipo: "FEDERAL",
        api: "Transferegov + DATASUS",
        url: "datasus.saude.gov.br",
        auth: "Acesso público",
        status: "RASTREÁVEL",
        programas: ["CAPS I", "CAPS II", "CAPS AD", "CAPS Infantil"],
        dormencia: "Alta — credenciamento complexo trava execução",
        prazo: "Anual + competências mensais",
        dificuldade: "Alta",
      },
      {
        nome: "Rede Cegonha / Saúde Mulher",
        tipo: "FEDERAL",
        api: "Transferegov",
        url: "transferegov.sistema.gov.br",
        auth: "Sem auth",
        status: "RASTREÁVEL",
        programas: ["Pré-natal", "Maternidade Segura", "Puerpério"],
        dormencia: "Alta — gestão técnica ausente",
        prazo: "Ciclo anual",
        dificuldade: "Alta",
      },
      {
        nome: "Vigilância em Saúde",
        tipo: "FEDERAL",
        api: "Portal Transparência",
        url: "portaldatransparencia.gov.br",
        auth: "Chave gratuita",
        status: "RASTREÁVEL",
        programas: ["Epidemiológica", "Sanitária", "Zoonoses"],
        dormencia: "Alta — frequente subnotificação técnica",
        prazo: "Anual",
        dificuldade: "Média",
      },
    ],
  },
  {
    id: "educacao",
    label: "EDUCAÇÃO",
    icon: "📚",
    cor: "#d97706",
    descricao: "FNDE / MEC / SIMEC",
    volume: "R$ 8,1B/ano",
    fontes: [
      {
        nome: "PNAE — Alimentação Escolar",
        tipo: "FEDERAL",
        api: "FNDE Dados Abertos",
        url: "fnde.gov.br/dadosabertos",
        auth: "Público",
        status: "RASTREÁVEL",
        programas: ["Merenda escolar pública e privada conveniada"],
        dormencia: "Baixa — bem executado, mas frequente irregularidade contábil",
        prazo: "Semestral",
        dificuldade: "Baixa",
      },
      {
        nome: "PNATE — Transporte Escolar",
        tipo: "FEDERAL",
        api: "FNDE Dados Abertos",
        url: "fnde.gov.br/dadosabertos",
        auth: "Público",
        status: "RASTREÁVEL",
        programas: ["Transporte zona rural", "Aquaviário"],
        dormencia: "Média — inconsistência cadastral frequente",
        prazo: "Semestral",
        dificuldade: "Baixa",
      },
      {
        nome: "PDDE — Dinheiro Direto",
        tipo: "FEDERAL",
        api: "SIGPC / FNDE",
        url: "sigpc.fnde.gov.br",
        auth: "CNPJ UEX",
        status: "PARCIALMENTE RASTREÁVEL",
        programas: ["PDDE Básico", "PDDE Qualidade", "PDDE Estrutura"],
        dormencia: "Alta — UEX sem prestação de contas bloqueiam verba",
        prazo: "Anual",
        dificuldade: "Alta",
      },
      {
        nome: "Proinfância — Creches",
        tipo: "FEDERAL",
        api: "Transferegov",
        url: "transferegov.sistema.gov.br",
        auth: "Sem auth",
        status: "RASTREÁVEL",
        programas: ["Construção de creches e pré-escolas"],
        dormencia: "Muito Alta — obras paralisadas frequentes",
        prazo: "Conforme cronograma obra",
        dificuldade: "Alta",
      },
    ],
  },
  {
    id: "esporte",
    label: "ESPORTE E LAZER",
    icon: "⚽",
    cor: "#0284c7",
    descricao: "Min. Esporte / Transferegov",
    volume: "R$ 890M/ano",
    fontes: [
      {
        nome: "PELC — Esporte e Lazer",
        tipo: "FEDERAL",
        api: "Transferegov",
        url: "transferegov.sistema.gov.br",
        auth: "Sem auth",
        status: "RASTREÁVEL",
        programas: ["Programa Esporte e Lazer da Cidade", "Vida Saudável"],
        dormencia: "Muito Alta — linha subutilizada no Nordeste",
        prazo: "Ciclo anual / edital",
        dificuldade: "Baixa",
      },
      {
        nome: "Esporte na Escola",
        tipo: "FEDERAL",
        api: "Transferegov + MEC",
        url: "transferegov.sistema.gov.br",
        auth: "Sem auth",
        status: "RASTREÁVEL",
        programas: ["Iniciação Esportiva", "Jogos Escolares"],
        dormencia: "Alta — municípios não aderem por falta de CNPJ OSC",
        prazo: "Anual",
        dificuldade: "Média",
      },
    ],
  },
  {
    id: "emendas",
    label: "EMENDAS PARLAMENTARES",
    icon: "🏛️",
    cor: "#dc2626",
    descricao: "SIGA Brasil / Portal Câmara",
    volume: "R$ 14,6B/ano",
    fontes: [
      {
        nome: "Emenda Individual Impositiva",
        tipo: "CONSTITUCIONAL",
        api: "SIGA Brasil SPARQL + Portal Transparência",
        url: "www12.senado.leg.br/orcamento/sigabrasil",
        auth: "Público (SPARQL)",
        status: "RASTREÁVEL",
        programas: ["Saúde", "Infraestrutura", "Assistência", "Educação"],
        dormencia: "Muito Alta — municípios não sabem que têm emenda empenhada",
        prazo: "31/dez (devolução automática)",
        dificuldade: "Baixa",
      },
      {
        nome: "Emenda de Bancada",
        tipo: "FEDERAL",
        api: "SIGA Brasil + Câmara API",
        url: "dadosabertos.camara.leg.br",
        auth: "Público",
        status: "RASTREÁVEL",
        programas: ["Definidos pela bancada estadual"],
        dormencia: "Alta — execução depende de articulação política",
        prazo: "Anual",
        dificuldade: "Média",
      },
      {
        nome: "Emenda de Comissão",
        tipo: "FEDERAL",
        api: "SIGA Brasil",
        url: "www12.senado.leg.br/orcamento/sigabrasil",
        auth: "Público",
        status: "RASTREÁVEL",
        programas: ["Temáticos por comissão parlamentar"],
        dormencia: "Alta",
        prazo: "Anual",
        dificuldade: "Alta",
      },
    ],
  },
  {
    id: "estadual",
    label: "FUNDOS ESTADUAIS",
    icon: "🗺️",
    cor: "#7c2d12",
    descricao: "AL / SE / PE",
    volume: "R$ 2,3B/ano (3 estados)",
    fontes: [
      {
        nome: "FEAC / FEAS — Alagoas",
        tipo: "ESTADUAL",
        api: "Scraping HTML",
        url: "transparencia.al.gov.br",
        auth: "Público",
        status: "SCRAPING NECESSÁRIO",
        programas: ["Assistência Social AL", "Proteção Especial AL"],
        dormencia: "Muito Alta — maioria dos municípios não acessa",
        prazo: "Varies",
        dificuldade: "Média",
      },
      {
        nome: "FEAS / FES — Sergipe",
        tipo: "ESTADUAL",
        api: "Scraping HTML",
        url: "transparencia.se.gov.br",
        auth: "Público",
        status: "SCRAPING NECESSÁRIO",
        programas: ["Assistência Social SE", "Saúde SE"],
        dormencia: "Alta",
        prazo: "Varies",
        dificuldade: "Média",
      },
      {
        nome: "FEAS / FES — Pernambuco",
        tipo: "ESTADUAL",
        api: "Scraping HTML + API beta",
        url: "transparencia.pe.gov.br",
        auth: "Público",
        status: "PARCIALMENTE RASTREÁVEL",
        programas: ["Assistência Social PE", "Saúde PE"],
        dormencia: "Alta",
        prazo: "Varies",
        dificuldade: "Média",
      },
    ],
  },
  {
    id: "privado",
    label: "FUNDAÇÕES PRIVADAS",
    icon: "🏆",
    cor: "#475569",
    descricao: "Editais / Captação",
    volume: "R$ 1,1B/ano em editais",
    fontes: [
      {
        nome: "Itaú Social",
        tipo: "PRIVADO",
        api: "Scraping / RSS",
        url: "itausocial.org.br/editais",
        auth: "Público",
        status: "RASTREÁVEL",
        programas: ["Educação", "Primeira Infância", "Juventude"],
        dormencia: "N/A — competitivo, não dormente",
        prazo: "Editais com prazo fixo",
        dificuldade: "Alta (competição)",
      },
      {
        nome: "Fundação Lemann",
        tipo: "PRIVADO",
        api: "Scraping",
        url: "fundacaolemann.org.br",
        auth: "Público",
        status: "RASTREÁVEL",
        programas: ["Educação pública", "Liderança", "Formação"],
        dormencia: "N/A",
        prazo: "Editais anuais",
        dificuldade: "Alta",
      },
      {
        nome: "BNDES Social / FEP",
        tipo: "MISTO",
        api: "Portal BNDES",
        url: "bndes.gov.br/editais",
        auth: "Público",
        status: "RASTREÁVEL",
        programas: ["Desenvolvimento social", "Cultura", "Saúde comunitária"],
        dormencia: "Alta — pouquíssimas OSCs do NE aplicam",
        prazo: "Editais anuais",
        dificuldade: "Muito Alta",
      },
    ],
  },
];

const STATUS_CORES = {
  "RASTREÁVEL": "#00d97e",
  "PARCIALMENTE RASTREÁVEL": "#f5c400",
  "SCRAPING NECESSÁRIO": "#ff7a00",
};

const DIFICULDADE_CORES = {
  "Baixa": "#00d97e",
  "Média": "#f5c400",
  "Alta": "#ff7a00",
  "Muito Alta": "#ff3c3c",
};

export default function MapaFontes() {
  const [eixoAtivo, setEixoAtivo] = useState(null);
  const [fonteDetalhe, setFonteDetalhe] = useState(null);

  const eixoSel = EIXOS.find(e => e.id === eixoAtivo);

  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      background: "#07090f",
      minHeight: "100vh",
      color: "#c8d8f0",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0b1426 0%, #0e1d38 100%)",
        borderBottom: "2px solid #1e3a5f",
        padding: "20px 32px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#00d97e",
            boxShadow: "0 0 10px #00d97e",
          }} />
          <span style={{
            fontSize: 16, fontWeight: 900, letterSpacing: 4,
            color: "#e8f4ff", textTransform: "uppercase",
          }}>
            MAPA DE FONTES — INTELIGÊNCIA DE SUBEXECUÇÃO
          </span>
        </div>
        <div style={{ fontSize: 10, color: "#4a7090", letterSpacing: 2 }}>
          7 EIXOS TEMÁTICOS  ·  {EIXOS.reduce((a,e) => a + e.fontes.length, 0)} FONTES RASTREADAS  ·  AL / SE / PE  ·  FEDERAL + ESTADUAL + PRIVADO
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 80px)" }}>

        {/* Eixos sidebar */}
        <div style={{
          width: 220,
          background: "#080c16",
          borderRight: "1px solid #0f1e35",
          overflowY: "auto",
          flexShrink: 0,
        }}>
          <div style={{ padding: "14px 16px 8px", fontSize: 9, color: "#3a5070", letterSpacing: 2 }}>
            EIXOS TEMÁTICOS
          </div>
          {EIXOS.map(eixo => (
            <button key={eixo.id}
              onClick={() => { setEixoAtivo(eixo.id === eixoAtivo ? null : eixo.id); setFonteDetalhe(null); }}
              style={{
                width: "100%",
                background: eixoAtivo === eixo.id ? eixo.cor + "18" : "transparent",
                border: "none",
                borderLeft: `3px solid ${eixoAtivo === eixo.id ? eixo.cor : "transparent"}`,
                borderBottom: "1px solid #0f1e35",
                color: eixoAtivo === eixo.id ? eixo.cor : "#6a8aaa",
                padding: "14px 16px",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: eixoAtivo === eixo.id ? 700 : 400,
                transition: "all 0.2s",
              }}>
              <div style={{ marginBottom: 4 }}>{eixo.icon} {eixo.label}</div>
              <div style={{ fontSize: 9, opacity: 0.7 }}>{eixo.descricao}</div>
              <div style={{ fontSize: 9, color: eixoAtivo === eixo.id ? eixo.cor : "#3a5070", marginTop: 3 }}>
                {eixo.volume}
              </div>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>

          {/* Overview quando nenhum eixo selecionado */}
          {!eixoAtivo && (
            <div>
              <div style={{
                fontSize: 12, color: "#4a7090", marginBottom: 24,
                padding: 16, background: "#0b1525",
                border: "1px solid #1a3050", borderRadius: 8,
              }}>
                ← Selecione um eixo para ver as fontes detalhadas com API, status de rastreabilidade e oportunidades de subexecução.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                {EIXOS.map(eixo => (
                  <div key={eixo.id}
                    onClick={() => setEixoAtivo(eixo.id)}
                    style={{
                      background: "#0b1525",
                      border: `1px solid ${eixo.cor}33`,
                      borderTop: `3px solid ${eixo.cor}`,
                      borderRadius: 8,
                      padding: "18px 20px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}>
                    <div style={{ fontSize: 18, marginBottom: 8 }}>{eixo.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: eixo.cor, marginBottom: 4 }}>{eixo.label}</div>
                    <div style={{ fontSize: 10, color: "#6a8aaa", marginBottom: 8 }}>{eixo.descricao}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#e8f4ff" }}>{eixo.volume}</span>
                      <span style={{
                        fontSize: 9, color: eixo.cor,
                        background: eixo.cor + "18",
                        padding: "2px 8px", borderRadius: 3,
                      }}>{eixo.fontes.length} fontes</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Architecture summary */}
              <div style={{
                marginTop: 24,
                background: "#0b1525",
                border: "1px solid #1a3050",
                borderRadius: 8,
                padding: 20,
              }}>
                <div style={{ fontSize: 10, color: "#f5c400", letterSpacing: 2, marginBottom: 14, fontWeight: 700 }}>
                  ⚙ ARQUITETURA DO SCRAPER
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "API REST", desc: "Portal Transparência, FNDE, Câmara", cor: "#00d97e", qtd: "4 fontes" },
                    { label: "SPARQL", desc: "SIGA Brasil (Senado)", cor: "#7c3aed", qtd: "1 fonte" },
                    { label: "Scraping HTML", desc: "Portais estaduais, Fundações", cor: "#f5c400", qtd: "5 fontes" },
                    { label: "Transferegov API", desc: "Convênios e emendas", cor: "#0284c7", qtd: "3 fontes" },
                    { label: "DATASUS", desc: "Blocos FNS, SIOPS", cor: "#059669", qtd: "2 fontes" },
                    { label: "Dados Abertos", desc: "FNDE, IBGE municípios", cor: "#d97706", qtd: "3 fontes" },
                  ].map((item, i) => (
                    <div key={i} style={{
                      background: item.cor + "10",
                      border: `1px solid ${item.cor}33`,
                      borderRadius: 6,
                      padding: "12px 14px",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: item.cor, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 9, color: "#6a8aaa", marginBottom: 6 }}>{item.desc}</div>
                      <div style={{ fontSize: 9, color: item.cor, opacity: 0.8 }}>{item.qtd}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Lista de fontes do eixo */}
          {eixoSel && !fonteDetalhe && (
            <div>
              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
                paddingBottom: 16, borderBottom: "1px solid #1a3050",
              }}>
                <span style={{ fontSize: 24 }}>{eixoSel.icon}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: eixoSel.cor }}>{eixoSel.label}</div>
                  <div style={{ fontSize: 10, color: "#4a7090" }}>{eixoSel.descricao} · {eixoSel.volume}</div>
                </div>
              </div>

              {eixoSel.fontes.map((fonte, i) => (
                <div key={i}
                  onClick={() => setFonteDetalhe(fonte)}
                  style={{
                    background: "#0b1525",
                    border: "1px solid #1a3050",
                    borderLeft: `3px solid ${eixoSel.cor}`,
                    borderRadius: 8,
                    padding: "18px 20px",
                    marginBottom: 12,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e8f4ff" }}>{fonte.nome}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: STATUS_CORES[fonte.status] || "#888",
                        background: (STATUS_CORES[fonte.status] || "#888") + "18",
                        padding: "2px 8px", borderRadius: 3,
                        letterSpacing: 1,
                      }}>{fonte.status}</span>
                      <span style={{
                        fontSize: 9,
                        color: DIFICULDADE_CORES[fonte.dificuldade] || "#888",
                        background: (DIFICULDADE_CORES[fonte.dificuldade] || "#888") + "18",
                        padding: "2px 8px", borderRadius: 3,
                      }}>Dif: {fonte.dificuldade}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: "#6a8aaa" }}>
                      <span style={{ color: "#3a6090" }}>API:</span> {fonte.api}
                    </span>
                    <span style={{ fontSize: 10, color: "#6a8aaa" }}>
                      <span style={{ color: "#3a6090" }}>Auth:</span> {fonte.auth}
                    </span>
                    <span style={{ fontSize: 10, color: "#6a8aaa" }}>
                      <span style={{ color: "#3a6090" }}>Prazo:</span> {fonte.prazo}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 11, color: fonte.dormencia.includes("Muito Alta") ? "#ff7a00" : "#8ab0cc",
                    background: "#060a14",
                    borderRadius: 4,
                    padding: "6px 10px",
                  }}>
                    ⚠ Dormência: {fonte.dormencia}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 10, color: "#3a6090" }}>
                    Clique para ver detalhes e código de integração →
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detalhe da fonte */}
          {fonteDetalhe && (
            <div>
              <button
                onClick={() => setFonteDetalhe(null)}
                style={{
                  background: "transparent", border: "1px solid #1a3050",
                  borderRadius: 4, color: "#6a8aaa",
                  fontFamily: "inherit", fontSize: 10, padding: "6px 14px",
                  cursor: "pointer", marginBottom: 20, letterSpacing: 1,
                }}>
                ← VOLTAR
              </button>
              <div style={{
                background: "#0b1525",
                border: `1px solid ${eixoSel.cor}44`,
                borderTop: `3px solid ${eixoSel.cor}`,
                borderRadius: 8,
                padding: 24,
              }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#e8f4ff", marginBottom: 6 }}>{fonteDetalhe.nome}</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, color: eixoSel.cor, background: eixoSel.cor + "18", padding: "2px 8px", borderRadius: 3 }}>{fonteDetalhe.tipo}</span>
                  <span style={{ fontSize: 9, color: STATUS_CORES[fonteDetalhe.status], background: STATUS_CORES[fonteDetalhe.status] + "18", padding: "2px 8px", borderRadius: 3 }}>{fonteDetalhe.status}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {[
                    ["Interface de Acesso", fonteDetalhe.api],
                    ["URL / Portal", fonteDetalhe.url],
                    ["Autenticação", fonteDetalhe.auth],
                    ["Prazo Crítico", fonteDetalhe.prazo],
                    ["Dormência", fonteDetalhe.dormencia],
                    ["Complexidade", fonteDetalhe.dificuldade],
                  ].map(([k, v], i) => (
                    <div key={i} style={{ borderBottom: "1px solid #0f1e35", paddingBottom: 10 }}>
                      <div style={{ fontSize: 9, color: "#3a6090", letterSpacing: 1, marginBottom: 4 }}>{k}</div>
                      <div style={{ fontSize: 12, color: "#a0c0e0" }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 9, color: "#3a6090", letterSpacing: 1, marginBottom: 8 }}>PROGRAMAS COBERTOS</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {fonteDetalhe.programas.map((p, i) => (
                      <span key={i} style={{
                        fontSize: 10, color: eixoSel.cor,
                        background: eixoSel.cor + "15",
                        border: `1px solid ${eixoSel.cor}33`,
                        padding: "3px 10px", borderRadius: 4,
                      }}>{p}</span>
                    ))}
                  </div>
                </div>

                {/* Snippet de código */}
                <div>
                  <div style={{ fontSize: 9, color: "#3a6090", letterSpacing: 1, marginBottom: 8 }}>SNIPPET DE INTEGRAÇÃO (Python)</div>
                  <div style={{
                    background: "#060a14",
                    border: "1px solid #1a3050",
                    borderRadius: 6,
                    padding: 16,
                    fontSize: 10,
                    color: "#7fb3cc",
                    lineHeight: 1.8,
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                  }}>
{fonteDetalhe.api.includes("REST") || fonteDetalhe.nome.includes("Portal") ?
`# Portal da Transparência — API REST
import requests

def buscar_${eixoSel.id}(codigo_ibge: str, ano: int):
    url = "https://api.portaldatransparencia.gov.br/api-de-dados/transferencias-voluntarias"
    headers = {"chave-api-dados": SEU_API_KEY}
    params = {"codigoMunicipio": codigo_ibge, "ano": ano, "pagina": 1}
    r = requests.get(url, headers=headers, params=params)
    return r.json()

# Chave gratuita: portaldatransparencia.gov.br/api-de-dados/cadastrar` :

fonteDetalhe.api.includes("SPARQL") ?
`# SIGA Brasil — Consulta SPARQL (Senado)
import requests

SIGA_ENDPOINT = "https://www12.senado.leg.br/orcamento/sparql"

query = """
SELECT ?acao ?valor_empenhado ?valor_pago
WHERE {
  ?emenda <http://...municipio_ibge> "CODIGO_IBGE" ;
          <http://...valor_empenhado> ?valor_empenhado ;
          <http://...valor_pago> ?valor_pago .
  FILTER (?valor_empenhado > ?valor_pago)
}
"""
r = requests.get(SIGA_ENDPOINT, params={"query": query, "format": "json"})
dados = r.json()["results"]["bindings"]` :

`# Scraping HTML — Portal Estadual
from bs4 import BeautifulSoup
import requests

def scrape_${eixoSel.id}_estadual(codigo_ibge: str, estado: str):
    url = f"https://transparencia.{estado.lower()}.gov.br/repasses/{codigo_ibge}"
    headers = {"User-Agent": "Mozilla/5.0 (pesquisa-publica/1.0)"}
    r = requests.get(url, headers=headers, timeout=20)
    soup = BeautifulSoup(r.text, "lxml")
    tabela = soup.find("table")
    if tabela:
        import pandas as pd
        return pd.read_html(str(tabela))[0]
    return None`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #07090f; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }
        button:hover { opacity: 0.85; }
        div[style*="cursor: pointer"]:hover { filter: brightness(1.08); }
      `}</style>
    </div>
  );
}
