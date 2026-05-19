
import { useState } from "react";

const ETAPAS_FLUXO = [
  {
    num: "01", cor: "#0ea5e9", icone: "📡",
    titulo: "COLETA DE EVIDÊNCIAS",
    subtitulo: "Campo + Digital",
    descricao: "Técnicos de campo (da OSC ou da própria prefeitura) usam app mobile para registrar execução em tempo real.",
    itens: [
      { tipo: "📸", label: "Fotos geolocalizadas + timestamp", tech: "EXIF + GPS obrigatório" },
      { tipo: "✍️", label: "Fichas de frequência digitais", tech: "Assinatura digital ou QR Code" },
      { tipo: "🎤", label: "Relatos de beneficiários", tech: "Áudio ou texto via app" },
      { tipo: "📋", label: "Relatórios técnicos de atendimento", tech: "Formulário estruturado" },
      { tipo: "🧾", label: "Notas fiscais e comprovantes", tech: "OCR automático" },
      { tipo: "📍", label: "Check-in de atividade no local", tech: "GPS + horário" },
    ],
    output: "Pacote de evidências bruto e rastreável por atividade"
  },
  {
    num: "02", cor: "#8b5cf6", icone: "🤖",
    titulo: "PROCESSAMENTO COM IA",
    subtitulo: "Validação + Geração",
    descricao: "Claude processa o pacote de evidências, valida consistência e gera os documentos oficiais necessários.",
    itens: [
      { tipo: "🔍", label: "Validação de geolocalização vs. endereço do projeto", tech: "Cruzamento automático" },
      { tipo: "📊", label: "Consolidação de indicadores (atendimentos, frequência)", tech: "Agregação inteligente" },
      { tipo: "📝", label: "Geração do relatório narrativo de execução", tech: "Claude API" },
      { tipo: "📈", label: "Gráficos de impacto automáticos", tech: "Recharts + dados reais" },
      { tipo: "⚠️", label: "Alerta de inconsistências antes de submeter", tech: "Checklist automatizado" },
      { tipo: "📄", label: "Montagem do dossiê para o órgão repassador", tech: "PDF estruturado" },
    ],
    output: "Relatório auditado, indicadores consolidados, dossiê pronto"
  },
  {
    num: "03", cor: "#f59e0b", icone: "🏛️",
    titulo: "SUBMISSÃO AOS SISTEMAS",
    subtitulo: "Transferegov + SIAFI",
    descricao: "O sistema prepara tudo e o gestor municipal/OSC só revisa e clica em submeter. Uma pessoa, 10 minutos.",
    itens: [
      { tipo: "🔗", label: "Transferegov — Prestação de Contas", tech: "API REST + preenchimento automático" },
      { tipo: "🏦", label: "SIAFI — Execução Financeira", tech: "Integração via webservice" },
      { tipo: "📋", label: "SIOPS — Saúde (quando aplicável)", tech: "Módulo específico" },
      { tipo: "📊", label: "RREO / RGF — Relatórios fiscais", tech: "Dados pré-formatados" },
      { tipo: "✅", label: "Confirmação de recebimento e protocolo", tech: "Notificação automática" },
      { tipo: "📁", label: "Arquivo local do dossiê completo", tech: "Cloud + backup físico" },
    ],
    output: "Protocolo de submissão, número de rastreamento, confirmação"
  },
  {
    num: "04", cor: "#10b981", icone: "🌐",
    titulo: "PUBLICAÇÃO AUTOMÁTICA",
    subtitulo: "Transparência Ativa",
    descricao: "Tudo que foi submetido ao governo é também publicado automaticamente no portal da prefeitura/OSC.",
    itens: [
      { tipo: "🌐", label: "Portal de Transparência da prefeitura", tech: "Widget embeddable ou API" },
      { tipo: "📱", label: "Página pública do projeto com evidências", tech: "Site gerado automaticamente" },
      { tipo: "🗺️", label: "Mapa de execução com fotos geolocalizadas", tech: "Mapbox + evidências" },
      { tipo: "📊", label: "Dashboard público de indicadores de impacto", tech: "Atualizado em tempo real" },
      { tipo: "📰", label: "Release de imprensa gerado pela IA", tech: "Claude API — tom jornalístico" },
      { tipo: "📲", label: "Post para redes sociais do parlamentar/prefeito", tech: "Formato pronto para publicar" },
    ],
    output: "URL pública, release, post social, dashboard ao vivo"
  },
];

const EVIDENCIAS_EXEMPLO = [
  { id:1, tipo:"foto", label:"Atividade SCFV — Delmiro Gouveia", data:"12/05/2025", local:"CRAS Centro", beneficiarios:24, validada:true, inconsistencia:null },
  { id:2, tipo:"frequencia", label:"Lista de Presença — Semana 3", data:"14/05/2025", local:"CRAS Centro", beneficiarios:22, validada:true, inconsistencia:null },
  { id:3, tipo:"foto", label:"Entrega de Kits — TEA", data:"15/05/2025", local:"CRAS Norte", beneficiarios:8, validada:false, inconsistencia:"GPS não coincide com endereço cadastrado (dist. 340m)" },
  { id:4, tipo:"relato", label:"Relato beneficiária — D.M.S.", data:"16/05/2025", local:"CRAS Centro", beneficiarios:1, validada:true, inconsistencia:null },
  { id:5, tipo:"nf", label:"NF 00483 — Material Pedagógico", data:"10/05/2025", local:"—", beneficiarios:0, validada:true, inconsistencia:null },
  { id:6, tipo:"relatorio", label:"Relatório Técnico — Maio Semana 2", data:"17/05/2025", local:"CRAS Centro", beneficiarios:31, validada:true, inconsistencia:null },
];

const MODELOS_PC = [
  { fundo:"FNAS/SUAS", prazo:"Trimestral", sistema:"Transferegov", complexidade:"Média", automacao:90 },
  { fundo:"FNS/Saúde", prazo:"Mensal (SIOPS)", sistema:"SIOPS + Transferegov", complexidade:"Alta", automacao:75 },
  { fundo:"FNDE", prazo:"Semestral", sistema:"SIGPC/FNDE", complexidade:"Média", automacao:80 },
  { fundo:"Emenda Parlamentar", prazo:"Conforme convênio", sistema:"Transferegov", complexidade:"Alta", automacao:85 },
  { fundo:"Fundo Estadual", prazo:"Varies", sistema:"Portal estadual", complexidade:"Média", automacao:60 },
];

const PRECO_SERVICO = [
  { tier:"BÁSICO", preco:"R$ 1.500/mês", descricao:"1 programa, coleta digital, relatório mensal, publicação automática", cor:"#6b7280" },
  { tier:"PROFISSIONAL", preco:"R$ 4.500/mês", descricao:"Até 5 programas, validação de campo, submissão ao Transferegov, portal transparência", cor:"#0ea5e9" },
  { tier:"PREMIUM", preco:"R$ 9.000/mês", descricao:"Programas ilimitados, técnico de campo dedicado, auditoria prévia, release de imprensa", cor:"#8b5cf6" },
  { tier:"PARLAMENTAR", preco:"R$ 6.000/mês", descricao:"Monitoramento de emendas, relatório de impacto eleitoral, post social automatizado", cor:"#f59e0b" },
];

export default function TransparenciaServico() {
  const [aba, setAba] = useState("fluxo");
  const [etapaSel, setEtapaSel] = useState(0);
  const [evSel, setEvSel] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);

  async function gerarRelatorioIA() {
    setGerando(true);
    setRelatorio(null);
    const validadas = EVIDENCIAS_EXEMPLO.filter(e=>e.validada);
    const totalBenef = validadas.reduce((a,e)=>a+e.beneficiarios,0);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:900,
          system:`Você é especialista em prestação de contas de projetos sociais no Brasil. Gera relatórios oficiais que passam na análise do Transferegov e Tribunal de Contas. Linguagem técnica, objetiva, compatível com normativas SUAS/SUS.`,
          messages:[{role:"user",content:
`Gere um RELATÓRIO NARRATIVO DE EXECUÇÃO para prestação de contas com base nas evidências abaixo:

Programa: SCFV — Serviço de Convivência e Fortalecimento de Vínculos
Município: Delmiro Gouveia — AL
Período: Maio 2025 — Semanas 2 e 3
Fundo: FNAS
Evidências validadas: ${validadas.length} registros
Total de beneficiários: ${totalBenef} atendimentos registrados
Locais: CRAS Centro e CRAS Norte
Tipos de evidência: fotos geolocalizadas, listas de frequência, relatos de beneficiários, notas fiscais, relatório técnico

Estrutura obrigatória:
1. IDENTIFICAÇÃO DO PROGRAMA (2 linhas)
2. RESUMO DA EXECUÇÃO NO PERÍODO (3-4 linhas — o que foi feito, onde, quantos atendidos)
3. INDICADORES ALCANÇADOS (tabela simplificada: meta × realizado × % atingido)
4. EVIDÊNCIAS APRESENTADAS (lista dos tipos com quantitativo)
5. ANÁLISE DE CONFORMIDADE (declaração de que a execução está em conformidade com o plano de trabalho)
6. CONCLUSÃO (2 linhas — recomendação para aprovação)

Tom: técnico, oficial, para aprovação em análise federal.`
          }]
        })
      });
      const data = await r.json();
      setRelatorio(data.content?.[0]?.text||"Erro.");
    } catch(e) { setRelatorio("Erro de conexão."); }
    setGerando(false);
  }

  const abas = [
    {id:"fluxo", label:"⚙️ Fluxo Completo"},
    {id:"evidencias", label:"📸 Gestão de Evidências"},
    {id:"sistemas", label:"🏛️ Sistemas de Destino"},
    {id:"modelo", label:"💰 Modelo de Negócio"},
  ];

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#f8fafc",minHeight:"100vh",color:"#0f172a"}}>

      {/* HEADER */}
      <div style={{
        background:"linear-gradient(135deg,#0f172a,#1e293b)",
        padding:"22px 32px",
        borderBottom:"3px solid #10b981",
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <span style={{fontSize:20,fontWeight:800,color:"#f8fafc",letterSpacing:-0.5}}>
                Prestação de Contas
              </span>
              <span style={{fontSize:11,background:"#10b981",color:"#fff",borderRadius:20,padding:"2px 10px",fontWeight:700}}>
                como Serviço
              </span>
            </div>
            <div style={{fontSize:11,color:"#64748b",letterSpacing:1}}>
              COLETA · VALIDAÇÃO · SUBMISSÃO · PUBLICAÇÃO — TUDO AUTOMÁTICO
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:"#64748b"}}>Receita recorrente mensal estimada</div>
            <div style={{fontSize:22,fontWeight:800,color:"#10b981"}}>R$ 45k–120k/mês</div>
            <div style={{fontSize:10,color:"#475569"}}>com 10–15 clientes ativos</div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 32px",display:"flex",gap:0}}>
        {abas.map(a=>(
          <button key={a.id} onClick={()=>setAba(a.id)}
            style={{background:"transparent",border:"none",
              borderBottom:aba===a.id?"3px solid #10b981":"3px solid transparent",
              color:aba===a.id?"#059669":"#64748b",padding:"12px 20px",
              cursor:"pointer",fontFamily:"inherit",fontSize:12,
              fontWeight:aba===a.id?700:400,marginBottom:-1,transition:"all 0.15s"}}>
            {a.label}
          </button>
        ))}
      </div>

      <div style={{padding:"28px 32px",maxWidth:1100,margin:"0 auto"}}>

        {/* ─── FLUXO ─── */}
        {aba==="fluxo" && (
          <div>
            {/* Timeline horizontal */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0,marginBottom:28,position:"relative"}}>
              {ETAPAS_FLUXO.map((e,i)=>(
                <div key={i} onClick={()=>setEtapaSel(i)}
                  style={{
                    background:etapaSel===i?"#fff":etapaSel>i?e.cor+"10":"#fff",
                    border:`2px solid ${etapaSel===i?e.cor:"#e2e8f0"}`,
                    borderRight:i<3?"none":"2px solid",
                    borderRightColor:etapaSel===i?e.cor:"#e2e8f0",
                    padding:"18px 16px",cursor:"pointer",transition:"all 0.2s",
                    position:"relative",
                  }}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{
                      fontSize:11,fontWeight:900,
                      background:e.cor,color:"#fff",
                      borderRadius:"50%",width:24,height:24,
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                    }}>{e.num}</span>
                    <span style={{fontSize:16}}>{e.icone}</span>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:"#0f172a",marginBottom:3}}>{e.titulo}</div>
                  <div style={{fontSize:10,color:"#64748b"}}>{e.subtitulo}</div>
                  {etapaSel===i && (
                    <div style={{position:"absolute",bottom:-8,left:"50%",transform:"translateX(-50%)",
                      width:0,height:0,borderLeft:"8px solid transparent",borderRight:"8px solid transparent",
                      borderTop:`8px solid ${e.cor}`}}/>
                  )}
                </div>
              ))}
            </div>

            {/* Detalhe da etapa */}
            {(() => {
              const e = ETAPAS_FLUXO[etapaSel];
              return (
                <div style={{
                  background:"#fff",border:`1px solid ${e.cor}44`,
                  borderTop:`4px solid ${e.cor}`,borderRadius:12,padding:24,marginBottom:20,
                  boxShadow:`0 4px 20px ${e.cor}15`,
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
                    <div>
                      <div style={{fontSize:17,fontWeight:800,color:"#0f172a",marginBottom:4}}>
                        {e.icone} {e.titulo}
                      </div>
                      <div style={{fontSize:12,color:"#64748b"}}>{e.descricao}</div>
                    </div>
                    <div style={{
                      background:e.cor+"15",border:`1px solid ${e.cor}33`,
                      borderRadius:8,padding:"8px 14px",textAlign:"center",flexShrink:0,
                    }}>
                      <div style={{fontSize:9,color:e.cor,letterSpacing:2,fontWeight:700}}>OUTPUT</div>
                      <div style={{fontSize:10,color:"#374151",marginTop:4,maxWidth:180,lineHeight:1.5}}>{e.output}</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                    {e.itens.map((item,j)=>(
                      <div key={j} style={{
                        background:e.cor+"08",border:`1px solid ${e.cor}22`,
                        borderRadius:8,padding:"12px 14px",
                      }}>
                        <div style={{fontSize:16,marginBottom:6}}>{item.tipo}</div>
                        <div style={{fontSize:11,fontWeight:600,color:"#1e293b",marginBottom:4}}>{item.label}</div>
                        <div style={{fontSize:10,color:e.cor,background:e.cor+"15",
                          borderRadius:4,padding:"2px 6px",display:"inline-block"}}>{item.tech}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* O que você substitui */}
            <div style={{
              background:"#0f172a",borderRadius:12,padding:24,
            }}>
              <div style={{fontSize:11,color:"#64748b",letterSpacing:2,fontFamily:"monospace",marginBottom:16}}>
                O QUE VOCÊ ELIMINA DA VIDA DO CLIENTE
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                <div>
                  <div style={{fontSize:11,color:"#ef4444",fontWeight:700,marginBottom:10}}>❌ ANTES (sem você)</div>
                  {[
                    "Técnico tira foto com celular pessoal sem geolocalização",
                    "Frequência em papel que some ou molha",
                    "Relatório escrito no Word pelo secretário na véspera do prazo",
                    "Submissão no Transferegov às 23h do último dia",
                    "Prestação de contas reprovada por falta de evidência",
                    "TCU questiona execução 2 anos depois",
                    "Portal de transparência desatualizado há 18 meses",
                  ].map((item,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                      <span style={{color:"#ef4444",fontSize:12,flexShrink:0}}>✗</span>
                      <span style={{fontSize:11,color:"#94a3b8",lineHeight:1.5}}>{item}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{fontSize:11,color:"#10b981",fontWeight:700,marginBottom:10}}>✅ COM VOCÊ</div>
                  {[
                    "App registra foto + GPS + horário automaticamente",
                    "Frequência digital com assinatura ou QR Code",
                    "Relatório narrativo gerado pela IA em 3 minutos",
                    "Submissão programada com 15 dias de antecedência",
                    "Dossiê auditado ANTES de submeter — zero reprovação",
                    "Histórico imutável que protege o gestor por 10 anos",
                    "Portal da prefeitura atualizado automaticamente",
                  ].map((item,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                      <span style={{color:"#10b981",fontSize:12,flexShrink:0}}>✓</span>
                      <span style={{fontSize:11,color:"#e2e8f0",lineHeight:1.5}}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── EVIDÊNCIAS ─── */}
        {aba==="evidencias" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>Painel de Evidências — SCFV Delmiro Gouveia</div>
                <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Maio 2025 · {EVIDENCIAS_EXEMPLO.filter(e=>e.validada).length} validadas · {EVIDENCIAS_EXEMPLO.filter(e=>!e.validada).length} com inconsistência</div>
              </div>
              <button onClick={gerarRelatorioIA} disabled={gerando}
                style={{
                  background:gerando?"#e2e8f0":"linear-gradient(135deg,#10b981,#059669)",
                  border:"none",borderRadius:8,color:gerando?"#94a3b8":"#fff",
                  fontFamily:"inherit",fontWeight:700,fontSize:12,
                  padding:"10px 20px",cursor:gerando?"not-allowed":"pointer",
                  boxShadow:gerando?"none":"0 4px 14px #10b98140",
                }}>
                {gerando?"⟳ Gerando relatório...":"🤖 Gerar Relatório com IA"}
              </button>
            </div>

            {/* Evidências */}
            <div style={{marginBottom:20}}>
              {EVIDENCIAS_EXEMPLO.map((ev,i)=>{
                const ICONES={foto:"📸",frequencia:"📋",relato:"🎤",nf:"🧾",relatorio:"📝"};
                return (
                  <div key={i} onClick={()=>setEvSel(evSel===i?null:i)}
                    style={{
                      background:"#fff",
                      border:`1px solid ${ev.inconsistencia?"#fbbf24":"#e2e8f0"}`,
                      borderLeft:`4px solid ${ev.inconsistencia?"#f59e0b":ev.validada?"#10b981":"#e2e8f0"}`,
                      borderRadius:8,padding:"12px 16px",marginBottom:8,
                      cursor:"pointer",transition:"all 0.15s",
                    }}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <span style={{fontSize:18}}>{ICONES[ev.tipo]||"📄"}</span>
                        <div>
                          <div style={{fontSize:12,fontWeight:600,color:"#1e293b"}}>{ev.label}</div>
                          <div style={{fontSize:10,color:"#64748b",marginTop:2}}>
                            {ev.data} · {ev.local}{ev.beneficiarios>0?` · ${ev.beneficiarios} beneficiários`:""}
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {ev.inconsistencia && (
                          <span style={{fontSize:10,background:"#fef3c7",border:"1px solid #fbbf24",
                            borderRadius:4,padding:"2px 8px",color:"#92400e"}}>
                            ⚠ Inconsistência
                          </span>
                        )}
                        <span style={{
                          fontSize:10,fontWeight:700,
                          background:ev.validada?"#dcfce7":"#f1f5f9",
                          border:`1px solid ${ev.validada?"#86efac":"#e2e8f0"}`,
                          borderRadius:4,padding:"2px 8px",
                          color:ev.validada?"#166534":"#64748b",
                        }}>{ev.validada?"✓ Validada":"Pendente"}</span>
                      </div>
                    </div>
                    {evSel===i && ev.inconsistencia && (
                      <div style={{marginTop:10,padding:"8px 12px",background:"#fef3c7",
                        borderRadius:6,fontSize:11,color:"#92400e"}}>
                        ⚠ <strong>Alerta IA:</strong> {ev.inconsistencia} — revisar antes de submeter.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Relatório IA */}
            {relatorio && (
              <div style={{
                background:"#fff",border:"1px solid #10b98144",
                borderTop:"4px solid #10b981",borderRadius:12,padding:24,
                boxShadow:"0 4px 20px #10b98115",
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>
                    📄 Relatório Narrativo Gerado — Pronto para Submissão
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <span style={{fontSize:10,background:"#dcfce7",border:"1px solid #86efac",
                      borderRadius:4,padding:"3px 10px",color:"#166534",fontWeight:700}}>
                      ✓ Auditado pela IA
                    </span>
                    <span style={{fontSize:10,background:"#dbeafe",border:"1px solid #93c5fd",
                      borderRadius:4,padding:"3px 10px",color:"#1e40af",fontWeight:700}}>
                      Pronto para Transferegov
                    </span>
                  </div>
                </div>
                <div style={{whiteSpace:"pre-wrap",fontSize:11,lineHeight:1.9,
                  color:"#374151",fontFamily:"'Courier New',monospace",
                  background:"#f8fafc",borderRadius:8,padding:16}}>
                  {relatorio}
                </div>
                <div style={{marginTop:14,display:"flex",gap:10}}>
                  {["📤 Submeter no Transferegov","🌐 Publicar no Portal","📧 Enviar ao Parlamentar","📱 Gerar Post Social"].map((btn,i)=>(
                    <button key={i} style={{
                      background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,
                      padding:"8px 14px",fontSize:10,color:"#374151",fontFamily:"inherit",
                      cursor:"pointer",fontWeight:600,
                    }}>{btn}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── SISTEMAS ─── */}
        {aba==="sistemas" && (
          <div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:15,fontWeight:800,color:"#0f172a",marginBottom:6}}>
                Sistemas de Governo — Cobertura de Integração
              </div>
              <div style={{fontSize:12,color:"#64748b"}}>
                Cada fundo tem seu sistema. Você cobre todos.
              </div>
            </div>
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden",marginBottom:20}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:"#f8fafc"}}>
                    {["Fundo","Prazo","Sistema","Complexidade","Automação %"].map(h=>(
                      <th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:10,
                        color:"#64748b",fontWeight:700,letterSpacing:1,
                        borderBottom:"1px solid #e2e8f0"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODELOS_PC.map((m,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid #f1f5f9"}}>
                      <td style={{padding:"12px 16px",fontWeight:700,color:"#1e293b"}}>{m.fundo}</td>
                      <td style={{padding:"12px 16px",color:"#475569"}}>{m.prazo}</td>
                      <td style={{padding:"12px 16px"}}>
                        <span style={{background:"#eff6ff",border:"1px solid #bfdbfe",
                          borderRadius:4,padding:"2px 8px",fontSize:10,color:"#1d4ed8"}}>
                          {m.sistema}
                        </span>
                      </td>
                      <td style={{padding:"12px 16px"}}>
                        <span style={{
                          background:m.complexidade==="Alta"?"#fef2f2":m.complexidade==="Média"?"#fefce8":"#f0fdf4",
                          color:m.complexidade==="Alta"?"#991b1b":m.complexidade==="Média"?"#854d0e":"#166534",
                          borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700,
                        }}>{m.complexidade}</span>
                      </td>
                      <td style={{padding:"12px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,background:"#e2e8f0",borderRadius:99,height:6,overflow:"hidden"}}>
                            <div style={{width:`${m.automacao}%`,height:"100%",
                              background:m.automacao>=85?"#10b981":m.automacao>=70?"#f59e0b":"#ef4444",
                              borderRadius:99}}/>
                          </div>
                          <span style={{fontSize:11,fontWeight:700,color:"#374151",minWidth:30}}>{m.automacao}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legal disclaimer */}
            <div style={{
              background:"#fefce8",border:"1px solid #fde047",borderLeft:"4px solid #eab308",
              borderRadius:10,padding:18,
            }}>
              <div style={{fontSize:12,fontWeight:700,color:"#854d0e",marginBottom:8}}>
                ⚖️ Estrutura Legal do Serviço
              </div>
              <div style={{fontSize:12,color:"#713f12",lineHeight:1.8}}>
                <strong>O gestor público mantém responsabilidade legal</strong> — você prepara e ele submete (1 clique).
                Isso é idêntico ao que escritórios de contabilidade fazem para empresas com a Receita Federal.
                <br/><br/>
                O contrato de prestação de serviços deve prever: (a) responsabilidade do contratante pela veracidade das informações fornecidas, (b) sua responsabilidade técnica pela organização e formatação, (c) confidencialidade dos dados. Consulte um advogado para modelar o contrato.
              </div>
            </div>
          </div>
        )}

        {/* ─── MODELO ─── */}
        {aba==="modelo" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginBottom:24}}>
              {PRECO_SERVICO.map((p,i)=>(
                <div key={i} style={{
                  background:"#fff",border:`1px solid ${p.cor}33`,
                  borderTop:`4px solid ${p.cor}`,borderRadius:12,
                  padding:22,boxShadow:`0 2px 12px ${p.cor}10`,
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:800,color:"#0f172a",letterSpacing:1}}>{p.tier}</div>
                    <div style={{fontSize:18,fontWeight:800,color:p.cor}}>{p.preco}</div>
                  </div>
                  <div style={{fontSize:12,color:"#475569",lineHeight:1.7}}>{p.descricao}</div>
                </div>
              ))}
            </div>

            {/* Por que é o melhor produto */}
            <div style={{background:"#0f172a",borderRadius:12,padding:24}}>
              <div style={{fontSize:11,color:"#64748b",letterSpacing:2,fontFamily:"monospace",marginBottom:18}}>
                POR QUE ESTE É O PRODUTO MAIS ESTRATÉGICO DO PORTFÓLIO
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                {[
                  { icone:"🔒", titulo:"Lock-in máximo", desc:"Quem gerencia a prestação de contas conhece tudo sobre o cliente. Custo de troca é altíssimo." },
                  { icone:"📅", titulo:"Receita 100% recorrente", desc:"Enquanto o programa existir, você cobra mensalidade. Contratos de 12–36 meses são padrão." },
                  { icone:"🛡️", titulo:"Você vira o escudo jurídico", desc:"Gestor que não tem processo no TCU porque você organizou tudo é um cliente para sempre." },
                  { icone:"🏆", titulo:"Viralidade política", desc:"Prefeito sem processo recomenda para o prefeito vizinho. Deputado satisfeito indica para a bancada." },
                  { icone:"📊", titulo:"Dados exclusivos", desc:"Você tem o histórico de execução de dezenas de municípios. Isso vale mais que qualquer banco de dados público." },
                  { icone:"🌐", titulo:"Portal público como vitrine", desc:"Cada site de transparência que você publica é propaganda gratuita do seu serviço para outros gestores." },
                ].map((item,i)=>(
                  <div key={i} style={{
                    background:"#1e293b",borderRadius:8,padding:"16px 14px",
                    border:"1px solid #334155",
                  }}>
                    <div style={{fontSize:20,marginBottom:8}}>{item.icone}</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>{item.titulo}</div>
                    <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.6}}>{item.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop:18,padding:"14px 18px",background:"#0f172a",
                border:"1px solid #334155",borderLeft:"4px solid #10b981",borderRadius:8,
              }}>
                <span style={{fontSize:12,color:"#10b981",fontWeight:700}}>POSICIONAMENTO: </span>
                <span style={{fontSize:12,color:"#e2e8f0",fontStyle:"italic"}}>
                  "Nós não fazemos relatório. Nós garantimos que o seu dinheiro nunca volta para a União e que nenhum gestor responde processo por falta de evidência."
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
