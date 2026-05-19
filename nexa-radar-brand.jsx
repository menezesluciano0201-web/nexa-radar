
import { useState } from "react";

const SECOES = [
  {
    id: "identidade", label: "Identidade", icone: "⚡",
    cor: "#f59e0b",
    conteudo: {
      titulo: "NEXA RADAR",
      subtitulo: "Inteligência de Subexecução e Recursos Públicos",
      tagline: "\"O radar que nenhum gestor público deveria operar sem.\"",
      missao: "Encontrar dinheiro público parado, estruturar sua execução e garantir que cada centavo vire impacto real — com rastreabilidade, prestação de contas e visibilidade política.",
      posicionamento: "Não fazemos projetos. Encontramos o dinheiro que ninguém está usando e transformamos em execução real.",
      nao_faz: ["Corre atrás de edital","Pede emenda","Faz projeto bonito que não passa","Desaparece depois da captação"],
      faz: ["Encontra dinheiro que já existe e está parado","Estrutura execução com quem tem capacidade real","Garante que o recurso vira impacto auditado","Entrega visibilidade política para quem financiou","Protege o gestor de processo no TCU"],
    }
  },
  {
    id: "clientes", label: "Clientes", icone: "🎯",
    cor: "#0ea5e9",
    clientes: [
      {
        titulo:"PREFEITO", icone:"🏙️", cor:"#0ea5e9",
        tagline:"\"Preciso mostrar que estou trazendo recurso para o meu município\"",
        dores:["Não sabe o que está disponível","Medo do TCU","Prazo vira surpresa","Equipe técnica fraca"],
        quer:["Aparecer trazendo recurso","Proteção jurídica","Direcionar para a base eleitoral","Dashboard para mostrar na câmara"],
        pitch:"Prefeito, você tem R$ X disponível e está usando só Y%. Eu identifico, monto o projeto, garanto a execução e a prestação de contas — com sua marca, no bairro que você escolher.",
        entrada:"Chegue com o relatório do município já pronto. Nunca peça reunião sem o número na mão.",
        erro:"Falar de 'projeto' antes de mostrar o dinheiro perdido",
      },
      {
        titulo:"DEPUTADO FEDERAL", icone:"🏛️", cor:"#f59e0b",
        tagline:"\"Preciso que minha emenda apareça antes das eleições\"",
        dores:["Emenda empenhada que não sai do papel","Não tem foto para mostrar","Saldo residual que ninguém vê","Devolução que mancha o histórico"],
        quer:["Ver tudo parado no seu nome","Controlar para onde vai","Alerta antes do prazo","Relatório de impacto eleitoral"],
        pitch:"Deputado, você tem R$ X parado em emendas que vencem em dezembro. Eu monitoro tudo, aciono as prefeituras e garanto que cada centavo vira entrega com seu nome.",
        entrada:"Via assessor parlamentar. Leve o mapa de emendas com % de execução.",
        erro:"Falar em 'captação' — soa como você vai pegar o dinheiro dele",
      },
      {
        titulo:"SENADOR", icone:"⚖️", cor:"#8b5cf6",
        tagline:"\"Tenho mandato de 8 anos — mas preciso de visibilidade agora\"",
        dores:["Base é o estado inteiro — impossível acompanhar","Visibilidade diluída","Prestação de contas é responsabilidade dele"],
        quer:["Visão estadual consolidada","Comparativo com rivais","Legado para governadoria","Rede de OSCs estaduais"],
        pitch:"Senador, você tem emendas em X municípios do estado e estimo que 40% está subexecutado. Entrego monitoramento estadual completo e relatório de impacto por região.",
        entrada:"Abordagem formal. O diferencial é o mapa estadual — nenhum assessor tem isso consolidado.",
        erro:"Tratar como deputado — quer visão estratégica, não operacional",
      },
      {
        titulo:"OSCIP / OSC", icone:"🌱", cor:"#10b981",
        tagline:"\"Temos capacidade de execução mas não conseguimos acessar os recursos\"",
        dores:["Mais tempo em burocracia que em projeto","Sobrevivência depende de edital","Não tem conexão política","Não sabe provar impacto"],
        quer:["Projetos garantidos o ano inteiro","Ser encontrada por quem tem recurso","Apoio técnico na burocracia","Crescer de forma estruturada"],
        pitch:"Você executa. Eu encontro o recurso, faço a ponte, estruturo o projeto e cuido da prestação de contas. Você aparece como quem entrega.",
        entrada:"Aborde no momento de renovação de convênio ou quando perdeu um edital.",
        erro:"Prometer recurso — você não garante aprovação, garante estruturação",
      },
    ]
  },
  {
    id: "modulos", label: "Módulos", icone: "⚙️",
    cor: "#10b981",
    modulos: [
      { num:"M1", icone:"📡", titulo:"Radar de Subexecução", cor:"#0ea5e9", receita:"Porta de entrada",
        desc:"Identifica programas com baixa execução cruzando estado, município, fundo e área temática.",
        output:"\"Prefeitura de X deixou R$ 2,3M parados no programa Y. Prazo: 15/12.\"",
        fontes:["Portal da Transparência (API)","Transferegov","SIGA Brasil","Portais estaduais"] },
      { num:"M2", icone:"🔬", titulo:"Diagnóstico Municipal", cor:"#8b5cf6", receita:"R$ 5k–20k",
        desc:"Input: nome da cidade. Output: mapa completo de oportunidades, pitch pronto, 3 ações prioritárias.",
        output:"\"Prefeito, você tem acesso a R$ 5M e está usando R$ 800k.\"",
        fontes:["FNAS","FNS","FNDE","Emendas por IBGE"] },
      { num:"M3", icone:"📋", titulo:"Gerador de Projetos", cor:"#f59e0b", receita:"5%–12% do captado",
        desc:"Templates: SCFV, TEA, CAPS, Idoso, Esporte. IA gera projeto completo e aprovável — texto que passa na análise federal.",
        output:"Plano de trabalho + metas físicas + indicadores SUAS/SUS + cronograma + orçamento",
        fontes:["Templates validados","Normativas SUAS/SUS","Histórico de aprovações"] },
      { num:"M4", icone:"🤝", titulo:"Casamento Emenda × OSCIP", cor:"#10b981", receita:"Fee de introdução",
        desc:"Score de compatibilidade: área temática (40%), município (30%), Transferegov (15%), histórico (15%).",
        output:"Ranking de OSCIPs + argumento político para o parlamentar + risco do casamento",
        fontes:["Cadastro de OSCIPs","Emendas por parlamentar","Histórico de execução"] },
      { num:"M5", icone:"🕸️", titulo:"Inteligência Política", cor:"#dc2626", receita:"Incluso nos planos",
        desc:"Mapa de alianças, oposições e risco de relacionamento. Alerta quando a combinação político × OSC × município gera fricção.",
        output:"Score de risco: Baixo / Médio / Alto + estratégia de entrada recomendada",
        fontes:["Dados eleitorais TSE","Declarações públicas","Mapa de coligações"] },
      { num:"M6", icone:"📊", titulo:"Prestação de Contas como Serviço", cor:"#0284c7", receita:"R$ 1,5k–9k/mês",
        desc:"Coleta evidências → valida → gera relatório auditado → submete ao Transferegov → publica no portal. Gestor clica uma vez.",
        output:"Relatório aprovado + protocolo + portal atualizado + release + post social",
        fontes:["App mobile campo","OCR de NFs","GPS + timestamp","Assinatura digital"] },
      { num:"M7", icone:"🌐", titulo:"Portal de Transparência", cor:"#7c3aed", receita:"Incluso no M6",
        desc:"Site ou widget gerado automaticamente para a prefeitura/OSC. Atualização automática pós-submissão.",
        output:"Dashboard público com indicadores, fotos geolocalizadas, mapa de execução",
        fontes:["Dados do M6","IBGE","Geolocalização das atividades"] },
    ]
  },
  {
    id: "fontes", label: "Fontes", icone: "🛰️",
    cor: "#8b5cf6",
    eixos: [
      { nome:"ASSISTÊNCIA SOCIAL", cor:"#7c3aed", vol:"R$ 4,2B/ano",
        fontes:["FNAS — Fundo a Fundo (SCFV, IGD-SUAS, TEA, Proteção)","BPC na Escola","Programa Criança Feliz","Proteção Social Especial"] },
      { nome:"SAÚDE", cor:"#059669", vol:"R$ 12,8B/ano",
        fontes:["FNS — PAB Fixo e Variável","ESF / ACS","CAPS (Saúde Mental)","Rede Cegonha","Vigilância em Saúde"] },
      { nome:"EDUCAÇÃO", cor:"#d97706", vol:"R$ 8,1B/ano",
        fontes:["PNAE (Alimentação Escolar)","PNATE (Transporte)","PDDE (Dinheiro Direto)","Proinfância (Creches)"] },
      { nome:"EMENDAS PARLAMENTARES", cor:"#dc2626", vol:"R$ 14,6B/ano",
        fontes:["Individual Impositiva (SIGA Brasil SPARQL)","Emenda de Bancada","Emenda de Comissão","Emenda de Relator"] },
      { nome:"FUNDOS ESTADUAIS", cor:"#7c2d12", vol:"R$ 2,3B/ano",
        fontes:["FEAC/FEAS — Alagoas","FEAS/FES — Sergipe","FEAS/FES — Pernambuco","Scraping portais estaduais"] },
      { nome:"PRIVADO / EDITAIS", cor:"#475569", vol:"R$ 1,1B/ano",
        fontes:["Itaú Social","Fundação Lemann","BNDES Social","Instituto Natura","Fundação Vale"] },
    ]
  },
  {
    id: "receita", label: "Receita", icone: "💰",
    cor: "#f59e0b",
  },
];

export default function NexaRadarPrompt() {
  const [aba, setAba] = useState("identidade");
  const [clienteSel, setClienteSel] = useState(0);
  const [moduloSel, setModuloSel] = useState(null);

  const secao = SECOES.find(s => s.id === aba);

  return (
    <div style={{
      fontFamily:"'DM Sans','Segoe UI',sans-serif",
      background:"#030712",
      minHeight:"100vh",
      color:"#e2e8f0",
    }}>

      {/* HERO */}
      <div style={{
        background:"linear-gradient(160deg, #0c1427 0%, #111827 50%, #0c1427 100%)",
        padding:"32px 40px 24px",
        borderBottom:"1px solid #1e2d45",
        position:"relative",
        overflow:"hidden",
      }}>
        {/* Grid pattern background */}
        <div style={{
          position:"absolute",inset:0,
          backgroundImage:"linear-gradient(#1e293b44 1px, transparent 1px), linear-gradient(90deg, #1e293b44 1px, transparent 1px)",
          backgroundSize:"40px 40px",
          opacity:0.3,
        }}/>
        <div style={{position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:10}}>
            <div style={{
              width:42,height:42,borderRadius:10,
              background:"linear-gradient(135deg,#f59e0b,#d97706)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:20,boxShadow:"0 4px 20px #f59e0b50",
            }}>⚡</div>
            <div>
              <div style={{fontSize:26,fontWeight:900,color:"#f8fafc",letterSpacing:-0.5}}>
                NEXA RADAR
              </div>
              <div style={{fontSize:11,color:"#64748b",letterSpacing:3,textTransform:"uppercase"}}>
                Inteligência de Subexecução · Prompt Mestre
              </div>
            </div>
          </div>
          <div style={{
            fontSize:15,color:"#94a3b8",fontStyle:"italic",
            borderLeft:"3px solid #f59e0b",paddingLeft:14,marginTop:8,
            maxWidth:700,lineHeight:1.6,
          }}>
            "Nós não captamos recursos. Nós ativamos os recursos que já existem e estão sendo desperdiçados —
            e garantimos que aparecem com o nome de quem deveria receber o crédito."
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{
        background:"#0a0f1e",borderBottom:"1px solid #1e2d45",
        display:"flex",padding:"0 40px",gap:0,overflowX:"auto",
      }}>
        {SECOES.map(s => (
          <button key={s.id} onClick={()=>{ setAba(s.id); setModuloSel(null); }}
            style={{
              background:"transparent",border:"none",
              borderBottom:aba===s.id?`3px solid ${s.cor}`:"3px solid transparent",
              color:aba===s.id?s.cor:"#475569",
              padding:"14px 22px",cursor:"pointer",fontFamily:"inherit",
              fontSize:12,fontWeight:aba===s.id?700:400,
              letterSpacing:0.5,whiteSpace:"nowrap",marginBottom:-1,transition:"all 0.15s",
            }}>
            {s.icone} {s.label}
          </button>
        ))}
      </div>

      <div style={{padding:"28px 40px",maxWidth:1100,margin:"0 auto"}}>

        {/* IDENTIDADE */}
        {aba==="identidade" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
              <div>
                <div style={{
                  background:"#0c1627",border:"1px solid #1e3a5f",borderTop:"3px solid #f59e0b",
                  borderRadius:12,padding:22,marginBottom:16,
                }}>
                  <div style={{fontSize:10,color:"#f59e0b",letterSpacing:2,fontWeight:700,marginBottom:8,fontFamily:"monospace"}}>MISSÃO</div>
                  <div style={{fontSize:13,color:"#cbd5e1",lineHeight:1.8}}>{secao.conteudo.missao}</div>
                </div>
                <div style={{
                  background:"#0c1627",border:"1px solid #1e3a5f",borderTop:"3px solid #0ea5e9",
                  borderRadius:12,padding:22,
                }}>
                  <div style={{fontSize:10,color:"#0ea5e9",letterSpacing:2,fontWeight:700,marginBottom:8,fontFamily:"monospace"}}>POSICIONAMENTO</div>
                  <div style={{fontSize:13,color:"#cbd5e1",lineHeight:1.8}}>{secao.conteudo.posicionamento}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{background:"#0c1627",border:"1px solid #ff3c3c33",borderRadius:12,padding:18}}>
                  <div style={{fontSize:10,color:"#ef4444",letterSpacing:2,fontWeight:700,marginBottom:10,fontFamily:"monospace"}}>
                    ✗ NÃO FAZ
                  </div>
                  {secao.conteudo.nao_faz.map((item,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                      <span style={{color:"#ef4444",fontSize:11}}>✗</span>
                      <span style={{fontSize:11,color:"#94a3b8"}}>{item}</span>
                    </div>
                  ))}
                </div>
                <div style={{background:"#0c1627",border:"1px solid #10b98133",borderRadius:12,padding:18}}>
                  <div style={{fontSize:10,color:"#10b981",letterSpacing:2,fontWeight:700,marginBottom:10,fontFamily:"monospace"}}>
                    ✓ FAZ
                  </div>
                  {secao.conteudo.faz.map((item,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                      <span style={{color:"#10b981",fontSize:11}}>→</span>
                      <span style={{fontSize:11,color:"#94a3b8"}}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Flywheel */}
            <div style={{
              background:"#0c1627",border:"1px solid #1e3a5f",borderRadius:12,padding:22,
            }}>
              <div style={{fontSize:10,color:"#64748b",letterSpacing:2,fontFamily:"monospace",marginBottom:14}}>
                O CICLO COMPLETO — FLYWHEEL DA NEXA RADAR
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                {[
                  {label:"Rastreia verba parada",sub:"M1 — Radar",cor:"#0ea5e9"},
                  {label:"→",sub:"",cor:"#334155"},
                  {label:"Capta o cliente",sub:"Prefeito / Parlamentar",cor:"#f59e0b"},
                  {label:"→",sub:"",cor:"#334155"},
                  {label:"Estrutura o projeto",sub:"M3 — Gerador",cor:"#8b5cf6"},
                  {label:"→",sub:"",cor:"#334155"},
                  {label:"Casa com OSCIP",sub:"M4 — Casamento",cor:"#10b981"},
                  {label:"→",sub:"",cor:"#334155"},
                  {label:"Coleta evidências",sub:"M6 — PC Serviço",cor:"#0284c7"},
                  {label:"→",sub:"",cor:"#334155"},
                  {label:"Publica + protege",sub:"M7 — Portal",cor:"#dc2626"},
                  {label:"→",sub:"",cor:"#334155"},
                  {label:"Renova contrato",sub:"Recorrência",cor:"#f59e0b"},
                ].map((item,i)=>(
                  item.label==="→" ? (
                    <span key={i} style={{fontSize:18,color:"#334155"}}>→</span>
                  ) : (
                    <div key={i} style={{
                      background:item.cor+"15",border:`1px solid ${item.cor}33`,
                      borderRadius:8,padding:"10px 12px",textAlign:"center",
                    }}>
                      <div style={{fontSize:11,fontWeight:700,color:item.cor}}>{item.label}</div>
                      <div style={{fontSize:9,color:"#64748b",marginTop:3}}>{item.sub}</div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CLIENTES */}
        {aba==="clientes" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:20}}>
              {secao.clientes.map((c,i)=>(
                <button key={i} onClick={()=>setClienteSel(i)}
                  style={{
                    flex:1,background:clienteSel===i?c.cor+"20":"#0c1627",
                    border:`2px solid ${clienteSel===i?c.cor:"#1e2d45"}`,
                    borderRadius:10,padding:"14px 10px",cursor:"pointer",fontFamily:"inherit",
                    transition:"all 0.2s",
                  }}>
                  <div style={{fontSize:20,marginBottom:4}}>{c.icone}</div>
                  <div style={{fontSize:11,fontWeight:700,color:clienteSel===i?c.cor:"#94a3b8"}}>{c.titulo}</div>
                </button>
              ))}
            </div>
            {(() => {
              const c = secao.clientes[clienteSel];
              return (
                <div>
                  <div style={{
                    background:c.cor+"10",border:`1px solid ${c.cor}33`,
                    borderLeft:`5px solid ${c.cor}`,borderRadius:10,
                    padding:"16px 20px",marginBottom:16,
                    fontSize:14,fontStyle:"italic",color:"#cbd5e1",
                  }}>{c.tagline}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                    <div style={{background:"#0c1627",border:"1px solid #1e2d45",borderRadius:10,padding:18}}>
                      <div style={{fontSize:10,color:"#ef4444",letterSpacing:2,fontWeight:700,marginBottom:10,fontFamily:"monospace"}}>DORES</div>
                      {c.dores.map((d,i)=>(
                        <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                          <span style={{color:"#ef4444"}}>•</span>
                          <span style={{fontSize:11,color:"#94a3b8"}}>{d}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{background:"#0c1627",border:"1px solid #1e2d45",borderRadius:10,padding:18}}>
                      <div style={{fontSize:10,color:c.cor,letterSpacing:2,fontWeight:700,marginBottom:10,fontFamily:"monospace"}}>O QUE QUER</div>
                      {c.quer.map((q,i)=>(
                        <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                          <span style={{color:c.cor}}>→</span>
                          <span style={{fontSize:11,color:"#94a3b8"}}>{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{background:"#111827",border:`1px solid ${c.cor}33`,borderRadius:10,padding:20,marginBottom:12}}>
                    <div style={{fontSize:10,color:c.cor,letterSpacing:2,fontWeight:700,marginBottom:8,fontFamily:"monospace"}}>PITCH DE ABERTURA</div>
                    <div style={{fontSize:14,color:"#f1f5f9",fontStyle:"italic",lineHeight:1.7}}>"{c.pitch}"</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <div style={{background:"#0c1627",border:"1px solid #1e2d45",borderRadius:8,padding:14}}>
                      <div style={{fontSize:10,color:"#10b981",letterSpacing:1,fontWeight:700,marginBottom:6,fontFamily:"monospace"}}>🚪 COMO ENTRAR</div>
                      <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.7}}>{c.entrada}</div>
                    </div>
                    <div style={{background:"#0c1627",border:"1px solid #ef444433",borderRadius:8,padding:14}}>
                      <div style={{fontSize:10,color:"#ef4444",letterSpacing:1,fontWeight:700,marginBottom:6,fontFamily:"monospace"}}>❌ ERRO MAIS COMUM</div>
                      <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.7}}>{c.erro}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* MÓDULOS */}
        {aba==="modulos" && (
          <div>
            {!moduloSel ? (
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
                {secao.modulos.map((m,i)=>(
                  <div key={i} onClick={()=>setModuloSel(m)}
                    style={{
                      background:"#0c1627",border:`1px solid ${m.cor}33`,
                      borderLeft:`4px solid ${m.cor}`,borderRadius:10,
                      padding:"18px 20px",cursor:"pointer",transition:"all 0.2s",
                    }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{
                          fontSize:11,fontWeight:900,color:"#0f172a",
                          background:m.cor,borderRadius:6,padding:"2px 8px",
                        }}>{m.num}</span>
                        <span style={{fontSize:16}}>{m.icone}</span>
                        <span style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{m.titulo}</span>
                      </div>
                      <span style={{
                        fontSize:10,color:m.cor,background:m.cor+"15",
                        border:`1px solid ${m.cor}33`,borderRadius:4,padding:"2px 8px",fontWeight:700,
                      }}>{m.receita}</span>
                    </div>
                    <div style={{fontSize:11,color:"#64748b",lineHeight:1.6,marginBottom:10}}>{m.desc}</div>
                    <div style={{
                      background:m.cor+"10",borderRadius:6,padding:"8px 10px",
                      fontSize:10,color:m.cor,fontStyle:"italic",
                    }}>→ {m.output}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <button onClick={()=>setModuloSel(null)}
                  style={{background:"transparent",border:"1px solid #1e2d45",borderRadius:4,
                    color:"#475569",fontFamily:"inherit",fontSize:10,padding:"6px 14px",
                    cursor:"pointer",marginBottom:16,letterSpacing:1}}>
                  ← VOLTAR
                </button>
                <div style={{
                  background:"#0c1627",border:`1px solid ${moduloSel.cor}44`,
                  borderTop:`4px solid ${moduloSel.cor}`,borderRadius:12,padding:24,
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:11,fontWeight:900,color:"#0f172a",background:moduloSel.cor,borderRadius:6,padding:"2px 10px"}}>{moduloSel.num}</span>
                      <span style={{fontSize:18}}>{moduloSel.icone}</span>
                      <span style={{fontSize:17,fontWeight:800,color:"#f1f5f9"}}>{moduloSel.titulo}</span>
                    </div>
                    <span style={{fontSize:14,fontWeight:800,color:moduloSel.cor}}>{moduloSel.receita}</span>
                  </div>
                  <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.8,marginBottom:16}}>{moduloSel.desc}</div>
                  <div style={{background:moduloSel.cor+"12",border:`1px solid ${moduloSel.cor}33`,
                    borderRadius:8,padding:14,marginBottom:16}}>
                    <div style={{fontSize:10,color:moduloSel.cor,letterSpacing:2,fontWeight:700,marginBottom:6,fontFamily:"monospace"}}>OUTPUT</div>
                    <div style={{fontSize:12,color:"#e2e8f0",fontStyle:"italic"}}>{moduloSel.output}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:"#475569",letterSpacing:2,fontWeight:700,marginBottom:8,fontFamily:"monospace"}}>FONTES DE DADOS</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {moduloSel.fontes.map((f,i)=>(
                        <span key={i} style={{
                          fontSize:10,background:"#1e2d45",border:"1px solid #334155",
                          borderRadius:4,padding:"3px 10px",color:"#94a3b8",
                        }}>{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FONTES */}
        {aba==="fontes" && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
            {secao.eixos.map((e,i)=>(
              <div key={i} style={{
                background:"#0c1627",border:`1px solid ${e.cor}33`,
                borderTop:`3px solid ${e.cor}`,borderRadius:10,padding:18,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:e.cor}}>{e.nome}</div>
                  <div style={{fontSize:11,fontWeight:700,color:"#e2e8f0"}}>{e.vol}</div>
                </div>
                {e.fontes.map((f,j)=>(
                  <div key={j} style={{display:"flex",gap:8,marginBottom:7}}>
                    <span style={{color:e.cor,fontSize:10,marginTop:2,flexShrink:0}}>▸</span>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{f}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* RECEITA */}
        {aba==="receita" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginBottom:20}}>
              {[
                {label:"Diagnóstico municipal",valor:"R$ 5k–20k",tipo:"Único",cor:"#0ea5e9",obs:"Porta de entrada — baixo risco, alto impacto"},
                {label:"Estruturação de projeto",valor:"5%–12%",tipo:"Success fee",cor:"#8b5cf6",obs:"Do valor total captado — alinhamento de interesse total"},
                {label:"Gestão contínua — Prefeito",valor:"R$ 3k–15k/mês",tipo:"Recorrente",cor:"#f59e0b",obs:"Depende do porte do município e nº de programas"},
                {label:"Monitoramento parlamentar",valor:"R$ 6k–15k/mês",tipo:"Recorrente",cor:"#dc2626",obs:"Por parlamentar — deputado ou senador"},
                {label:"Prestação de Contas Serviço",valor:"R$ 1,5k–9k/mês",tipo:"Recorrente",cor:"#10b981",obs:"Por programa ativo — o produto de maior lock-in"},
                {label:"Licença plataforma — OSCIP",valor:"R$ 2k–5k/mês",tipo:"Recorrente",cor:"#0284c7",obs:"Acesso ao sistema de matching e templates"},
              ].map((item,i)=>(
                <div key={i} style={{
                  background:"#0c1627",border:`1px solid ${item.cor}33`,
                  borderTop:`3px solid ${item.cor}`,borderRadius:10,padding:18,
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0"}}>{item.label}</div>
                    <span style={{
                      fontSize:9,background:item.cor+"20",border:`1px solid ${item.cor}44`,
                      borderRadius:4,padding:"2px 8px",color:item.cor,fontWeight:700,flexShrink:0,marginLeft:8,
                    }}>{item.tipo}</span>
                  </div>
                  <div style={{fontSize:20,fontWeight:900,color:item.cor,marginBottom:6}}>{item.valor}</div>
                  <div style={{fontSize:10,color:"#64748b"}}>{item.obs}</div>
                </div>
              ))}
            </div>
            {/* Simulação */}
            <div style={{background:"#111827",border:"1px solid #1e2d45",borderRadius:12,padding:22}}>
              <div style={{fontSize:10,color:"#64748b",letterSpacing:2,fontFamily:"monospace",marginBottom:14}}>
                SIMULAÇÃO — 18 CLIENTES ATIVOS
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>
                {[
                  {label:"5 prefeituras\nPlano Profissional",valor:"R$ 37,5k",cor:"#f59e0b"},
                  {label:"3 deputados\nMonitoramento",valor:"R$ 27k",cor:"#dc2626"},
                  {label:"1 senador\nPacote Estadual",valor:"R$ 15k",cor:"#8b5cf6"},
                  {label:"9 OSCIPs\nLicença",valor:"R$ 27k",cor:"#10b981"},
                ].map((item,i)=>(
                  <div key={i} style={{background:"#1e293b",borderRadius:8,padding:14,textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#64748b",marginBottom:8,lineHeight:1.6,whiteSpace:"pre-line"}}>{item.label}</div>
                    <div style={{fontSize:18,fontWeight:900,color:item.cor}}>{item.valor}</div>
                    <div style={{fontSize:9,color:"#475569"}}>/ mês</div>
                  </div>
                ))}
              </div>
              <div style={{
                borderTop:"1px solid #1e2d45",paddingTop:14,
                display:"flex",justifyContent:"space-between",alignItems:"center",
              }}>
                <div style={{fontSize:13,color:"#94a3b8"}}>
                  MRR total (18 clientes) + success fees estimados
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:28,fontWeight:900,color:"#10b981"}}>R$ 106,5k</div>
                  <div style={{fontSize:10,color:"#64748b"}}>por mês recorrente</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#030712;}
        ::-webkit-scrollbar-thumb{background:#1e2d45;border-radius:4px;}
        button:hover{opacity:0.88;}
      `}</style>
    </div>
  );
}
