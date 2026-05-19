
import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// DATA LAYER
// ─────────────────────────────────────────────

const PARLAMENTARES = [
  {
    id: "dep001", tipo: "Deputado Federal", nome: "João Mendonça", partido: "PSD",
    estado: "AL", mandato: "2023-2027", coalizado: ["MDB","PP","Republicanos"],
    oposicao: ["PT","PSOL"], aliancaGov: "BASE", risco: "Baixo",
    avatar: "JM", cor: "#2563eb",
    emendas: [
      { id:"e1", ano:2025, tipo:"Individual Impositiva", area:"Saúde", municipio:"Delmiro Gouveia - AL", dotacao:1200000, empenhado:1200000, pago:180000, status:"CRÍTICO", prazo:"2025-12-31", oscipCasada:null },
      { id:"e2", ano:2025, tipo:"Individual Impositiva", area:"Assistência Social", municipio:"Palmeira dos Índios - AL", dotacao:850000, empenhado:850000, pago:0, status:"ZERADO", prazo:"2025-12-31", oscipCasada:null },
      { id:"e3", ano:2025, tipo:"Bancada AL", area:"Infraestrutura", municipio:"Arapiraca - AL", dotacao:3200000, empenhado:2100000, pago:950000, status:"BAIXO", prazo:"2025-12-31", oscipCasada:"OSCIP Norte AL" },
      { id:"e4", ano:2024, tipo:"Individual Impositiva", area:"Educação", municipio:"Maceió - AL", dotacao:500000, empenhado:500000, pago:500000, status:"DEVOLVIDO", prazo:"2024-12-31", oscipCasada:null },
    ]
  },
  {
    id:"sen001", tipo:"Senador", nome:"Maria das Dores", partido:"MDB",
    estado:"SE", mandato:"2023-2031", coalizado:["PSD","PP","União"], oposicao:["PL","Novo"],
    aliancaGov:"APOIO", risco:"Médio", avatar:"MD", cor:"#7c3aed",
    emendas:[
      { id:"e5", ano:2025, tipo:"Individual Impositiva", area:"Saúde", municipio:"Lagarto - SE", dotacao:2400000, empenhado:2400000, pago:320000, status:"CRÍTICO", prazo:"2025-12-31", oscipCasada:null },
      { id:"e6", ano:2025, tipo:"Individual Impositiva", area:"TEA / Autismo", municipio:"Nossa Sra. do Socorro - SE", dotacao:780000, empenhado:780000, pago:0, status:"ZERADO", prazo:"2025-09-30", oscipCasada:null },
      { id:"e7", ano:2025, tipo:"Comissão Saúde", area:"Saúde Mental", municipio:"Aracaju - SE", dotacao:1800000, empenhado:900000, pago:210000, status:"BAIXO", prazo:"2025-12-31", oscipCasada:"Instituto Cuidar SE" },
    ]
  },
  {
    id:"dep002", tipo:"Deputado Federal", nome:"Carlos Ferraz", partido:"PT",
    estado:"PE", mandato:"2023-2027", coalizado:["PCdoB","PSOL","PDT"], oposicao:["PL","PSD","Novo"],
    aliancaGov:"GOVERNO", risco:"Baixo", avatar:"CF", cor:"#dc2626",
    emendas:[
      { id:"e8", ano:2025, tipo:"Individual Impositiva", area:"Assistência Social", municipio:"Caruaru - PE", dotacao:960000, empenhado:960000, pago:85000, status:"CRÍTICO", prazo:"2025-12-31", oscipCasada:null },
      { id:"e9", ano:2025, tipo:"Individual Impositiva", area:"Esporte", municipio:"Petrolina - PE", dotacao:420000, empenhado:420000, pago:0, status:"ZERADO", prazo:"2025-10-31", oscipCasada:null },
      { id:"e10", ano:2025, tipo:"Relator", area:"Infraestrutura Social", municipio:"Garanhuns - PE", dotacao:5600000, empenhado:3200000, pago:1800000, status:"BAIXO", prazo:"2025-12-31", oscipCasada:"ONG Sertão Vivo" },
    ]
  },
];

const OSCIPS = [
  { id:"o1", nome:"CEAFAS — Centro de Apoio", estado:"AL", areas:["Assistência Social","TEA","Idoso"], municipios:["Delmiro Gouveia - AL","Palmeira dos Índios - AL"], capacidade:850000, habilitada:true, transferegov:true, nota:9.2, projetos:12 },
  { id:"o2", nome:"Instituto Nordeste Social", estado:"AL/SE", areas:["Saúde","Assistência Social","Educação"], municipios:["Lagarto - SE","Nossa Sra. do Socorro - SE","Arapiraca - AL"], capacidade:2500000, habilitada:true, transferegov:true, nota:8.8, projetos:21 },
  { id:"o3", nome:"OSCIP Sertão Solidário", estado:"PE", areas:["Esporte","Juventude","Assistência Social"], municipios:["Caruaru - PE","Petrolina - PE","Garanhuns - PE"], capacidade:600000, habilitada:true, transferegov:false, nota:7.4, projetos:6 },
  { id:"o4", nome:"Rede Inclusão NE", estado:"AL/SE/PE", areas:["TEA","Saúde Mental","BPC Escola"], municipios:["Lagarto - SE","Caruaru - PE","Maceió - AL"], capacidade:1800000, habilitada:true, transferegov:true, nota:9.5, projetos:33 },
  { id:"o5", nome:"Instituto Cuidar SE", estado:"SE", areas:["Saúde","CAPS","Idoso"], municipios:["Aracaju - SE","Lagarto - SE","Estância - SE"], capacidade:1200000, habilitada:true, transferegov:true, nota:8.1, projetos:15 },
];

const PARTIDOS_REDE = {
  "PSD":   { cor:"#1d4ed8", aliados:["MDB","PP","Republicanos","União"], ideologia:"Centro" },
  "MDB":   { cor:"#7c3aed", aliados:["PSD","PP","PSDB","Cidadania"], ideologia:"Centro" },
  "PT":    { cor:"#dc2626", aliados:["PCdoB","PSOL","PDT","Solidariedade"], ideologia:"Esquerda" },
  "PL":    { cor:"#92400e", aliados:["PP","Republicanos","Progressistas"], ideologia:"Direita" },
  "PP":    { cor:"#065f46", aliados:["PSD","PL","MDB"], ideologia:"Centro-Direita" },
  "União": { cor:"#b45309", aliados:["MDB","PSD","PSDB"], ideologia:"Centro-Direita" },
};

const fmtBRL = v => v?.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const fmtPct = (pago, dot) => dot > 0 ? ((pago/dot)*100).toFixed(0) : 0;

const STATUS_META = {
  "ZERADO":   { cor:"#ff3c3c", bg:"#ff3c3c18", label:"⛔ ZERADO",    urgencia:4 },
  "CRÍTICO":  { cor:"#ff7a00", bg:"#ff7a0018", label:"🔴 CRÍTICO",   urgencia:3 },
  "BAIXO":    { cor:"#f5c400", bg:"#f5c40018", label:"🟡 BAIXO",     urgencia:2 },
  "DEVOLVIDO":{ cor:"#6b7280", bg:"#6b728018", label:"↩ DEVOLVIDO", urgencia:1 },
  "OK":       { cor:"#00d97e", bg:"#00d97e18", label:"✅ OK",        urgencia:0 },
};

const RISCO_META = {
  "Baixo": { cor:"#00d97e", icone:"🟢" },
  "Médio": { cor:"#f5c400", icone:"🟡" },
  "Alto":  { cor:"#ff3c3c", icone:"🔴" },
};

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function InteligenciaPolitica() {
  const [aba, setAba] = useState("painel");
  const [parlSel, setParlSel] = useState(null);
  const [oscipSel, setOscipSel] = useState(null);
  const [casando, setCasando] = useState(null); // emenda sendo casada
  const [casamentos, setCasamentos] = useState({});
  const [iaTexto, setIaTexto] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [filtroPartido, setFiltroPartido] = useState(null);

  const todasEmendas = PARLAMENTARES.flatMap(p =>
    p.emendas.map(e => ({ ...e, parlamentar: p }))
  );

  const totalParado = todasEmendas
    .filter(e => e.status !== "DEVOLVIDO")
    .reduce((a, e) => a + (e.empenhado - e.pago), 0);

  const vencendo30d = todasEmendas.filter(e => {
    if (!e.prazo) return false;
    const dias = (new Date(e.prazo) - new Date()) / 86400000;
    return dias <= 90 && e.status !== "DEVOLVIDO";
  }).length;

  // Score de match emenda × OSCIP
  function scoreMatch(emenda, oscip) {
    let score = 0;
    if (oscip.areas.includes(emenda.area)) score += 40;
    if (oscip.municipios.some(m => m === emenda.municipio)) score += 30;
    if (oscip.habilitada) score += 15;
    if (oscip.transferegov) score += 15;
    return score;
  }

  function melhoresMatches(emenda) {
    return [...OSCIPS]
      .map(o => ({ ...o, score: scoreMatch(emenda, o) }))
      .filter(o => o.score > 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  async function gerarBriefingParlamentar(parlamentar) {
    setIaLoading(true);
    setIaTexto("");
    const emendasResumo = parlamentar.emendas.map(e =>
      `${e.tipo} - ${e.area} - ${e.municipio}: ${fmtBRL(e.empenhado)} empenhado, ${fmtPct(e.pago,e.empenhado)}% pago, status ${e.status}, prazo ${e.prazo}`
    ).join("\n");
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:900,
          system:`Você é assessor político sênior especializado em execução de emendas parlamentares no Brasil. Seu briefing é direto, estratégico e politicamente sensível. Escreva em português, tom executivo.`,
          messages:[{ role:"user", content:
`Parlamentar: ${parlamentar.nome} (${parlamentar.partido} - ${parlamentar.estado})
Tipo: ${parlamentar.tipo} | Mandato: ${parlamentar.mandato}
Aliados: ${parlamentar.coalizado.join(", ")} | Oposição: ${parlamentar.oposicao.join(", ")}
Posição no governo: ${parlamentar.aliancaGov}

Emendas ${new Date().getFullYear()}:
${emendasResumo}

Gere um BRIEFING ESTRATÉGICO com:
1. SITUAÇÃO CRÍTICA (2 linhas — o que está em risco de devolução e impacto político)
2. OPORTUNIDADE IMEDIATA (o que pode ser executado nos próximos 60 dias)
3. RISCO DE IMAGEM (como a subexecução afeta o mandato e a base eleitoral)
4. ESTRATÉGIA RECOMENDADA (3 ações concretas com prioridade)
5. PERFIL POLÍTICO (como abordar esse parlamentar — o que ele valoriza, o que evitar)

Seja específico. Esse briefing vai para uma reunião real.`
          }]
        })
      });
      const data = await r.json();
      setIaTexto(data.content?.[0]?.text || "Erro ao gerar briefing.");
    } catch(e) { setIaTexto("Erro de conexão."); }
    setIaLoading(false);
  }

  async function gerarMatchIA(emenda, matches) {
    setIaLoading(true);
    setIaTexto("");
    const matchesDesc = matches.map(m =>
      `${m.nome} (${m.estado}): score ${m.score}%, nota ${m.nota}, ${m.projetos} projetos, Transferegov: ${m.transferegov?"sim":"não"}`
    ).join("\n");
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:600,
          system:`Especialista em casamento entre emendas parlamentares e OSCIPs no Brasil. Direto e estratégico.`,
          messages:[{ role:"user", content:
`Emenda: ${emenda.tipo} — ${emenda.area} — ${emenda.municipio}
Valor: ${fmtBRL(emenda.empenhado)} | Status: ${emenda.status} | Prazo: ${emenda.prazo}

OSCIPs candidatas:
${matchesDesc}

Recomende o melhor casamento e por quê. Inclua:
1. OSCIP RECOMENDADA e justificativa (2 linhas)
2. ARGUMENTO PARA O PARLAMENTAR aceitar essa OSCIP (1 linha — foco político)
3. PRÓXIMO PASSO OPERACIONAL (o que fazer nos próximos 7 dias)
4. RISCO DO CASAMENTO (o que pode dar errado)`
          }]
        })
      });
      const data = await r.json();
      setIaTexto(data.content?.[0]?.text || "Erro.");
    } catch(e) { setIaTexto("Erro de conexão."); }
    setIaLoading(false);
  }

  const abas = [
    { id:"painel",    icone:"⚡", label:"Painel de Alerta" },
    { id:"parlamentares", icone:"🏛️", label:"Parlamentares" },
    { id:"casamento", icone:"🤝", label:"Casa Emenda × OSCIP" },
    { id:"rede",      icone:"🕸️", label:"Rede Política" },
  ];

  return (
    <div style={{
      fontFamily:"'DM Mono','Courier New',monospace",
      background:"#06080f",
      minHeight:"100vh",
      color:"#c8d8f0",
    }}>
      {/* HEADER */}
      <div style={{
        background:"linear-gradient(135deg,#0c1428,#111e38)",
        borderBottom:"2px solid #1e3558",
        padding:"16px 28px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18,fontWeight:900,letterSpacing:3,color:"#e8f4ff",textTransform:"uppercase"}}>
              INTELIGÊNCIA POLÍTICA
            </span>
            <span style={{
              fontSize:9,background:"#f5c40020",border:"1px solid #f5c40066",
              borderRadius:3,padding:"2px 8px",color:"#f5c400",letterSpacing:2,
            }}>MÓDULO 6</span>
          </div>
          <div style={{fontSize:9,color:"#3a5878",letterSpacing:2,marginTop:3}}>
            PARLAMENTARES · EMENDAS · CASAMENTO OSCIP · REDE DE ALIANÇAS
          </div>
        </div>
        <div style={{display:"flex",gap:20,textAlign:"right"}}>
          {[
            {l:"PARADO",v:fmtBRL(totalParado),c:"#ff3c3c"},
            {l:"VENCENDO",v:`${vencendo30d} emendas`,c:"#ff7a00"},
            {l:"PARLAMENTARES",v:PARLAMENTARES.length,c:"#f5c400"},
          ].map((k,i) => (
            <div key={i}>
              <div style={{fontSize:8,color:"#3a5878",letterSpacing:2}}>{k.l}</div>
              <div style={{fontSize:16,fontWeight:900,color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div style={{background:"#060810",borderBottom:"1px solid #1a2e48",display:"flex",padding:"0 28px"}}>
        {abas.map(a => (
          <button key={a.id} onClick={() => { setAba(a.id); setIaTexto(""); setParlSel(null); }}
            style={{
              background:aba===a.id?"#0d1e38":"transparent",
              border:"none", borderBottom:aba===a.id?"2px solid #f5c400":"2px solid transparent",
              color:aba===a.id?"#f5c400":"#4a6888",
              padding:"12px 20px",cursor:"pointer",fontFamily:"inherit",
              fontSize:11,fontWeight:aba===a.id?700:400,letterSpacing:1,
            }}>
            {a.icone} {a.label}
          </button>
        ))}
      </div>

      <div style={{padding:"22px 28px",maxHeight:"calc(100vh - 130px)",overflowY:"auto"}}>

        {/* ─── PAINEL DE ALERTAS ─── */}
        {aba==="painel" && (
          <div>
            {/* Alertas urgentes */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,color:"#f5c400",letterSpacing:2,fontWeight:700,marginBottom:12}}>
                ⚡ EMENDAS EM ESTADO CRÍTICO — AÇÃO IMEDIATA
              </div>
              {todasEmendas
                .filter(e=>e.status==="ZERADO"||e.status==="CRÍTICO")
                .sort((a,b)=>(b.empenhado-b.pago)-(a.empenhado-a.pago))
                .map((e,i) => {
                  const sm = STATUS_META[e.status];
                  const diasRestantes = Math.floor((new Date(e.prazo)-new Date())/86400000);
                  const matches = melhoresMatches(e);
                  return (
                    <div key={i} style={{
                      background:"#0c1628",border:`1px solid ${sm.cor}44`,
                      borderLeft:`4px solid ${sm.cor}`,borderRadius:8,
                      padding:"16px 18px",marginBottom:10,
                      display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,
                    }}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                          <span style={{
                            fontSize:9,background:sm.bg,border:`1px solid ${sm.cor}`,
                            borderRadius:3,padding:"2px 8px",color:sm.cor,fontWeight:700,letterSpacing:1,
                          }}>{sm.label}</span>
                          <span style={{fontSize:11,color:"#7a9ec0"}}>{e.parlamentar.nome}</span>
                          <span style={{
                            fontSize:9,background:e.parlamentar.cor+"22",
                            border:`1px solid ${e.parlamentar.cor}`,borderRadius:3,
                            padding:"1px 6px",color:e.parlamentar.cor,
                          }}>{e.parlamentar.partido}</span>
                        </div>
                        <div style={{fontSize:12,color:"#d0e4f8",fontWeight:700,marginBottom:4}}>
                          {e.tipo} — {e.area}
                        </div>
                        <div style={{fontSize:10,color:"#4a6888"}}>{e.municipio}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:20,fontWeight:900,color:sm.cor}}>
                          {fmtBRL(e.empenhado-e.pago)}
                        </div>
                        <div style={{fontSize:9,color:diasRestantes<60?"#ff7a00":"#4a6888",marginTop:3}}>
                          {diasRestantes>0?`${diasRestantes} dias p/ prazo`:"PRAZO VENCIDO"} · {fmtPct(e.pago,e.empenhado)}% pago
                        </div>
                        {matches.length>0 && (
                          <div style={{fontSize:9,color:"#00d97e",marginTop:4}}>
                            {matches.length} OSCIP(s) compatível(is)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Emendas devolvidas */}
            <div>
              <div style={{fontSize:10,color:"#6b7280",letterSpacing:2,fontWeight:700,marginBottom:12}}>
                ↩ EMENDAS DEVOLVIDAS — HISTÓRICO DE PERDA POLÍTICA
              </div>
              {todasEmendas.filter(e=>e.status==="DEVOLVIDO").map((e,i)=>(
                <div key={i} style={{
                  background:"#0a1020",border:"1px solid #2a3848",
                  borderLeft:"4px solid #4b5563",borderRadius:8,
                  padding:"12px 18px",marginBottom:8,
                  display:"flex",justifyContent:"space-between",alignItems:"center",opacity:0.7,
                }}>
                  <div>
                    <span style={{fontSize:11,color:"#6b7280"}}>{e.parlamentar.nome} — {e.area} — {e.municipio}</span>
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:"#4b5563"}}>{fmtBRL(e.dotacao)} devolvidos</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── PARLAMENTARES ─── */}
        {aba==="parlamentares" && (
          <div>
            {!parlSel ? (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
                {PARLAMENTARES.map(p => {
                  const saldoParado = p.emendas.reduce((a,e)=>a+(e.empenhado-e.pago),0);
                  const criticos = p.emendas.filter(e=>e.status==="ZERADO"||e.status==="CRÍTICO").length;
                  return (
                    <div key={p.id} onClick={()=>{ setParlSel(p); setIaTexto(""); }}
                      style={{
                        background:"#0c1628",border:`1px solid ${p.cor}33`,
                        borderTop:`4px solid ${p.cor}`,borderRadius:10,
                        padding:20,cursor:"pointer",transition:"all 0.2s",
                      }}>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                        <div style={{
                          width:44,height:44,borderRadius:"50%",
                          background:p.cor+"28",border:`2px solid ${p.cor}`,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:14,fontWeight:900,color:p.cor,
                        }}>{p.avatar}</div>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:"#e8f4ff"}}>{p.nome}</div>
                          <div style={{fontSize:10,color:"#4a6888"}}>{p.tipo} · {p.estado}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                        <span style={{
                          fontSize:9,background:p.cor+"20",border:`1px solid ${p.cor}44`,
                          borderRadius:3,padding:"2px 8px",color:p.cor,fontWeight:700,
                        }}>{p.partido}</span>
                        <span style={{
                          fontSize:9,color:RISCO_META[p.risco].cor,
                        }}>{RISCO_META[p.risco].icone} Risco {p.risco}</span>
                      </div>
                      <div style={{borderTop:"1px solid #1a2e48",paddingTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div>
                          <div style={{fontSize:8,color:"#3a5878",letterSpacing:1}}>PARADO</div>
                          <div style={{fontSize:15,fontWeight:900,color:"#ff7a00"}}>{fmtBRL(saldoParado)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:8,color:"#3a5878",letterSpacing:1}}>CRÍTICOS</div>
                          <div style={{fontSize:15,fontWeight:900,color:criticos>0?"#ff3c3c":"#00d97e"}}>{criticos} emendas</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <button onClick={()=>{setParlSel(null);setIaTexto("");}}
                  style={{background:"transparent",border:"1px solid #1a2e48",borderRadius:4,
                    color:"#4a6888",fontFamily:"inherit",fontSize:10,padding:"6px 14px",
                    cursor:"pointer",marginBottom:18,letterSpacing:1}}>
                  ← VOLTAR
                </button>
                <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,
                  paddingBottom:16,borderBottom:"1px solid #1a2e48"}}>
                  <div style={{
                    width:56,height:56,borderRadius:"50%",
                    background:parlSel.cor+"28",border:`2px solid ${parlSel.cor}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:18,fontWeight:900,color:parlSel.cor,
                  }}>{parlSel.avatar}</div>
                  <div>
                    <div style={{fontSize:18,fontWeight:900,color:"#e8f4ff"}}>{parlSel.nome}</div>
                    <div style={{fontSize:11,color:"#4a6888"}}>{parlSel.tipo} · {parlSel.partido} · {parlSel.estado} · {parlSel.mandato}</div>
                    <div style={{display:"flex",gap:6,marginTop:6}}>
                      {parlSel.coalizado.map(pt=>(
                        <span key={pt} style={{fontSize:9,background:"#0c1a2e",border:"1px solid #1e3048",
                          borderRadius:3,padding:"1px 6px",color:"#6a8aaa"}}>+ {pt}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{marginLeft:"auto"}}>
                    <button onClick={()=>gerarBriefingParlamentar(parlSel)}
                      disabled={iaLoading}
                      style={{
                        background:iaLoading?"#1a2e48":"linear-gradient(135deg,#f5c400,#e0a800)",
                        border:"none",borderRadius:6,color:"#06080f",fontFamily:"inherit",
                        fontWeight:900,fontSize:11,letterSpacing:1,padding:"10px 20px",cursor:iaLoading?"not-allowed":"pointer",
                      }}>
                      {iaLoading?"⟳ GERANDO...":"🧠 BRIEFING IA"}
                    </button>
                  </div>
                </div>

                {/* Emendas do parlamentar */}
                {parlSel.emendas.map((e,i) => {
                  const sm = STATUS_META[e.status];
                  const pct = fmtPct(e.pago,e.empenhado);
                  return (
                    <div key={i} style={{
                      background:"#0c1628",border:`1px solid ${sm.cor}33`,
                      borderLeft:`3px solid ${sm.cor}`,borderRadius:8,
                      padding:"14px 18px",marginBottom:10,
                    }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div>
                          <span style={{fontSize:9,background:sm.bg,border:`1px solid ${sm.cor}`,
                            borderRadius:3,padding:"2px 8px",color:sm.cor,fontWeight:700,
                            letterSpacing:1,marginRight:8}}>{sm.label}</span>
                          <span style={{fontSize:12,color:"#d0e4f8",fontWeight:700}}>{e.tipo} · {e.area}</span>
                          <div style={{fontSize:10,color:"#4a6888",marginTop:4}}>{e.municipio} · prazo: {e.prazo}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:18,fontWeight:900,color:sm.cor}}>{fmtBRL(e.empenhado-e.pago)}</div>
                          <div style={{fontSize:9,color:"#4a6888"}}>parado de {fmtBRL(e.empenhado)}</div>
                        </div>
                      </div>
                      <div style={{background:"#1a2e48",borderRadius:3,height:6,overflow:"hidden",marginBottom:6}}>
                        <div style={{width:`${pct}%`,height:"100%",background:sm.cor,borderRadius:3,transition:"width 1s"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontSize:9,color:"#4a6888"}}>{pct}% pago</span>
                        {e.oscipCasada && <span style={{fontSize:9,color:"#00d97e"}}>🤝 {e.oscipCasada}</span>}
                      </div>
                    </div>
                  );
                })}

                {/* Briefing IA */}
                {iaTexto && (
                  <div style={{background:"#0c1628",border:"1px solid #f5c40033",
                    borderLeft:"4px solid #f5c400",borderRadius:8,padding:20,marginTop:16,
                    whiteSpace:"pre-wrap",fontSize:11,lineHeight:1.9,color:"#c8d8f0"}}>
                    <div style={{fontSize:9,color:"#f5c400",letterSpacing:2,fontWeight:700,marginBottom:12}}>
                      🧠 BRIEFING ESTRATÉGICO — {parlSel.nome.toUpperCase()}
                    </div>
                    {iaTexto}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── CASAMENTO EMENDA × OSCIP ─── */}
        {aba==="casamento" && (
          <div>
            <div style={{fontSize:10,color:"#4a6888",marginBottom:20,
              padding:"12px 16px",background:"#0a1420",border:"1px solid #1a2e48",borderRadius:8}}>
              Selecione uma emenda sem OSCIP casada para visualizar os melhores matches e acionar a IA para recomendar o casamento ideal.
            </div>
            {!casando ? (
              <div>
                {todasEmendas
                  .filter(e=>!e.oscipCasada && e.status!=="DEVOLVIDO")
                  .sort((a,b)=>STATUS_META[b.status].urgencia-STATUS_META[a.status].urgencia)
                  .map((e,i) => {
                    const sm = STATUS_META[e.status];
                    const matches = melhoresMatches(e);
                    return (
                      <div key={i} onClick={()=>{ setCasando(e); setIaTexto(""); }}
                        style={{
                          background:"#0c1628",border:`1px solid ${sm.cor}33`,
                          borderLeft:`3px solid ${sm.cor}`,borderRadius:8,
                          padding:"14px 18px",marginBottom:10,cursor:"pointer",transition:"all 0.2s",
                        }}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                              <span style={{fontSize:9,background:sm.bg,border:`1px solid ${sm.cor}`,
                                borderRadius:3,padding:"2px 7px",color:sm.cor,fontWeight:700}}>{sm.label}</span>
                              <span style={{fontSize:10,color:"#7a9ec0"}}>{e.parlamentar.nome} · {e.parlamentar.partido}</span>
                            </div>
                            <div style={{fontSize:12,color:"#d0e4f8",fontWeight:700}}>{e.tipo} — {e.area}</div>
                            <div style={{fontSize:10,color:"#4a6888",marginTop:3}}>{e.municipio}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:18,fontWeight:900,color:sm.cor}}>{fmtBRL(e.empenhado-e.pago)}</div>
                            <div style={{fontSize:9,color:"#00d97e",marginTop:4}}>
                              {matches.length > 0 ? `${matches.length} OSCIP(s) compatível(is)` : "Sem match direto"}
                            </div>
                            <div style={{fontSize:9,color:"#3a5878",marginTop:2}}>Clique para casar →</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div>
                <button onClick={()=>{setCasando(null);setIaTexto("");}}
                  style={{background:"transparent",border:"1px solid #1a2e48",borderRadius:4,
                    color:"#4a6888",fontFamily:"inherit",fontSize:10,padding:"6px 14px",
                    cursor:"pointer",marginBottom:18,letterSpacing:1}}>
                  ← VOLTAR
                </button>

                {/* Emenda selecionada */}
                <div style={{background:"#0c1628",border:"1px solid #f5c40033",
                  borderTop:"3px solid #f5c400",borderRadius:8,padding:18,marginBottom:20}}>
                  <div style={{fontSize:10,color:"#f5c400",letterSpacing:2,marginBottom:8,fontWeight:700}}>EMENDA SELECIONADA</div>
                  <div style={{fontSize:15,fontWeight:900,color:"#e8f4ff",marginBottom:4}}>{casando.tipo} — {casando.area}</div>
                  <div style={{display:"flex",gap:20,fontSize:10,color:"#6a8aaa"}}>
                    <span>{casando.municipio}</span>
                    <span>{casando.parlamentar.nome} ({casando.parlamentar.partido})</span>
                    <span style={{color:"#ff7a00",fontWeight:700}}>{fmtBRL(casando.empenhado-casando.pago)} parado</span>
                    <span>Prazo: {casando.prazo}</span>
                  </div>
                </div>

                {/* Matches */}
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:10,color:"#4a6888",letterSpacing:2,marginBottom:12}}>OSCIPS COMPATÍVEIS — RANKING</div>
                  {melhoresMatches(casando).map((o,i) => (
                    <div key={i} style={{
                      background:i===0?"#0a1e10":"#0c1628",
                      border:`1px solid ${i===0?"#00d97e44":"#1a2e48"}`,
                      borderLeft:`3px solid ${i===0?"#00d97e":i===1?"#f5c400":"#3a5878"}`,
                      borderRadius:8,padding:"14px 18px",marginBottom:8,
                      display:"flex",justifyContent:"space-between",alignItems:"center",
                    }}>
                      <div>
                        {i===0&&<div style={{fontSize:9,color:"#00d97e",fontWeight:700,letterSpacing:1,marginBottom:4}}>⭐ MELHOR MATCH</div>}
                        <div style={{fontSize:13,fontWeight:700,color:"#d0e4f8"}}>{o.nome}</div>
                        <div style={{fontSize:10,color:"#4a6888",marginTop:3}}>
                          {o.estado} · {o.areas.join(", ")} · {o.projetos} projetos
                        </div>
                        <div style={{display:"flex",gap:8,marginTop:6}}>
                          {o.habilitada&&<span style={{fontSize:9,color:"#00d97e",background:"#00d97e15",padding:"1px 6px",borderRadius:3}}>✓ Habilitada</span>}
                          {o.transferegov&&<span style={{fontSize:9,color:"#0284c7",background:"#0284c715",padding:"1px 6px",borderRadius:3}}>✓ Transferegov</span>}
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:22,fontWeight:900,color:i===0?"#00d97e":i===1?"#f5c400":"#6a8aaa"}}>{o.score}%</div>
                        <div style={{fontSize:9,color:"#3a5878"}}>compatibilidade</div>
                        <div style={{fontSize:11,color:"#7a9ec0",marginTop:4}}>Nota {o.nota}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={()=>gerarMatchIA(casando,melhoresMatches(casando))}
                  disabled={iaLoading}
                  style={{
                    background:iaLoading?"#1a2e48":"linear-gradient(135deg,#00d97e,#00b86a)",
                    border:"none",borderRadius:6,color:"#06080f",fontFamily:"inherit",
                    fontWeight:900,fontSize:11,letterSpacing:1,padding:"10px 22px",
                    cursor:iaLoading?"not-allowed":"pointer",marginBottom:16,
                  }}>
                  {iaLoading?"⟳ ANALISANDO...":"🤝 IA — RECOMENDAR MELHOR CASAMENTO"}
                </button>

                {iaTexto && (
                  <div style={{background:"#0a1e10",border:"1px solid #00d97e33",
                    borderLeft:"4px solid #00d97e",borderRadius:8,padding:20,
                    whiteSpace:"pre-wrap",fontSize:11,lineHeight:1.9,color:"#c8d8f0"}}>
                    <div style={{fontSize:9,color:"#00d97e",letterSpacing:2,fontWeight:700,marginBottom:12}}>
                      🤝 RECOMENDAÇÃO DE CASAMENTO — IA
                    </div>
                    {iaTexto}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── REDE POLÍTICA ─── */}
        {aba==="rede" && (
          <div>
            <div style={{marginBottom:20,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {PARLAMENTARES.map(p => (
                <div key={p.id} style={{background:"#0c1628",border:`1px solid ${p.cor}33`,
                  borderTop:`3px solid ${p.cor}`,borderRadius:8,padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#d0e4f8"}}>{p.nome}</div>
                    <span style={{fontSize:9,background:p.cor+"20",border:`1px solid ${p.cor}`,
                      borderRadius:3,padding:"1px 6px",color:p.cor,fontWeight:700}}>{p.partido}</span>
                  </div>
                  <div style={{fontSize:9,color:"#3a5878",marginBottom:8,letterSpacing:1}}>ALIANÇAS</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>
                    {p.coalizado.map(pt=>(
                      <span key={pt} style={{
                        fontSize:9,padding:"2px 7px",borderRadius:3,fontWeight:700,
                        background:(PARTIDOS_REDE[pt]?.cor||"#3a5878")+"25",
                        color:(PARTIDOS_REDE[pt]?.cor||"#3a5878"),
                        border:`1px solid ${(PARTIDOS_REDE[pt]?.cor||"#3a5878")}44`,
                      }}>+ {pt}</span>
                    ))}
                  </div>
                  <div style={{fontSize:9,color:"#3a5878",marginBottom:6,letterSpacing:1}}>OPOSIÇÃO</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
                    {p.oposicao.map(pt=>(
                      <span key={pt} style={{fontSize:9,padding:"2px 7px",borderRadius:3,
                        background:"#ff3c3c15",color:"#ff7a7a",border:"1px solid #ff3c3c33",
                      }}>✕ {pt}</span>
                    ))}
                  </div>
                  <div style={{borderTop:"1px solid #1a2e48",paddingTop:10,
                    display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:9,color:
                      p.aliancaGov==="GOVERNO"?"#00d97e":
                      p.aliancaGov==="BASE"?"#0284c7":
                      p.aliancaGov==="APOIO"?"#f5c400":"#ff7a00",
                      fontWeight:700,}}>
                      {p.aliancaGov==="GOVERNO"?"🟢":p.aliancaGov==="BASE"?"🔵":p.aliancaGov==="APOIO"?"🟡":"🔴"} {p.aliancaGov}
                    </span>
                    <span style={{fontSize:9,color:RISCO_META[p.risco].cor}}>
                      {RISCO_META[p.risco].icone} Risco de relacionamento: {p.risco}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Legenda estratégica */}
            <div style={{background:"#0a1420",border:"1px solid #1a2e48",borderRadius:8,padding:18}}>
              <div style={{fontSize:10,color:"#f5c400",letterSpacing:2,fontWeight:700,marginBottom:12}}>
                🎯 LÓGICA DE MITIGAÇÃO DE RISCO POLÍTICO
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16,fontSize:11,color:"#7a9ec0",lineHeight:1.8}}>
                <div>
                  <div style={{color:"#d0e4f8",fontWeight:700,marginBottom:6}}>Por que o módulo político importa:</div>
                  Emenda de deputado PT não executa bem com prefeito PL.
                  OSC ligada a uma liderança vai melhor com o parlamentar que a conhece.
                  Casamento errado gera atrito, atrasa liberação, mata o projeto.
                </div>
                <div>
                  <div style={{color:"#d0e4f8",fontWeight:700,marginBottom:6}}>Como usar o score de risco:</div>
                  Risco Baixo = abordagem direta possível.<br/>
                  Risco Médio = necessário intermediário de confiança.<br/>
                  Risco Alto = requer estratégia de entrada diferente ou parceiro local como porta de entrada.
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#06080f;}
        ::-webkit-scrollbar-thumb{background:#1e3558;border-radius:4px;}
        button:hover{opacity:0.88;}
      `}</style>
    </div>
  );
}
