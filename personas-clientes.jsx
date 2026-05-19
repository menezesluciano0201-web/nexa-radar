
import { useState } from "react";

const PERSONAS = [
  {
    id: "prefeito",
    titulo: "PREFEITO",
    subtitulo: "Gestor Municipal",
    icone: "🏙️",
    cor: "#0ea5e9",
    corEscura: "#0369a1",
    avatar: "PM",
    tagline: "\"Preciso mostrar que estou trazendo recurso para o meu município\"",
    perfil: "Eleito para mandato de 4 anos. Pensa em reeleição desde o primeiro dia. Responde à Câmara, à imprensa local e à população. Tem secretários que não entendem de captação. Tem contador que tem medo de convênio. Tem assessor jurídico que diz não para tudo.",

    dores: [
      { icone:"😰", titulo:"Medo do Tribunal de Contas", desc:"Qualquer prestação de contas errada vira processo. O secretário prefere não executar a arriscar." },
      { icone:"🤷", titulo:"Não sabe o que está disponível", desc:"Ninguém na prefeitura acompanha o que chegou, o que venceu, o que pode ser pedido. Falta inteligência." },
      { icone:"⏰", titulo:"Prazo vira surpresa", desc:"Descobre que perdeu R$ 2M só quando o dinheiro já voltou para a União. A notícia vaza para a oposição." },
      { icone:"🏗️", titulo:"Obra parada é foto na campanha adversária", desc:"Emenda empenhada e não executada vira munição política na próxima eleição." },
      { icone:"👥", titulo:"Equipe técnica fraca ou ausente", desc:"Não tem quem escreva projeto, preencha o Transferegov, ou acompanhe a execução." },
      { icone:"🤝", titulo:"Dependência do deputado sem controle", desc:"Quer o recurso mas não quer ficar refém. Quer ter autonomia sobre o que vai ser feito." },
    ],

    desejos: [
      { icone:"🏆", titulo:"Aparecer trazendo recurso", desc:"A foto na inauguração. O anúncio no Facebook. 'Prefeito garante R$ 3M para saúde'." },
      { icone:"🛡️", titulo:"Estar protegido juridicamente", desc:"Quer executar sem medo. Quer que alguém garanta que a prestação de contas vai passar." },
      { icone:"🎯", titulo:"Direcionar para sua base", desc:"Quer que o recurso chegue no bairro certo, na associação certa, no grupo que vai às urnas." },
      { icone:"📊", titulo:"Ter dashboard para mostrar na câmara", desc:"Relatório de impacto. Números de atendimento. Prova de que está gerindo bem." },
      { icone:"🔗", titulo:"Ter parceria com OSC de confiança", desc:"Quer executar com quem ele confia politicamente, não com quem o sistema jogar." },
    ],

    medos: [
      "Devolver dinheiro e a oposição descobrir",
      "Convênio barrado pela CGU ou TCU",
      "Depender de deputado de partido rival",
      "OSC parceira com problema de idoneidade",
      "Perder emenda para município vizinho",
    ],

    pitchIdeal: "Prefeito, você tem R$ X disponível nos fundos federais e está usando só Y%. Eu identifico esse dinheiro, monto o projeto, garanto a execução e a prestação de contas — tudo com sua marca, no bairro que você escolher, com a OSC que você aprovar.",

    gatilhos: [
      "Mostre o dinheiro que ele está perdendo AGORA",
      "Fale em proteção jurídica antes de falar em recurso",
      "Sempre vincule ao ativo político — bairro, base, eleitorado",
      "Nunca fale em 'projeto' — fale em 'entrega para a população'",
    ],
  },

  {
    id: "deputado",
    titulo: "DEPUTADO FEDERAL",
    subtitulo: "Parlamentar da Câmara",
    icone: "🏛️",
    cor: "#f59e0b",
    corEscura: "#b45309",
    avatar: "DF",
    tagline: "\"Preciso que minha emenda apareça antes das eleições\"",
    perfil: "Tem R$ 25M+ em emendas impositivas por mandato. Distribui para municípios da sua base eleitoral. Depende de prefeitos aliados para executar. Tem assessores que mal entendem o Transferegov. Pensa o tempo todo em 2026.",

    dores: [
      { icone:"💸", titulo:"Emenda empenhada que não sai do papel", desc:"O dinheiro está lá, o prefeito assinou, e meses depois nada aconteceu. O prazo chega e tudo volta." },
      { icone:"📸", titulo:"Não tem foto para mostrar", desc:"Sem execução, não tem inauguração. Sem inauguração, não tem visibilidade eleitoral. A emenda some silenciosamente." },
      { icone:"😤", titulo:"Prefeito que 'sequestra' a emenda", desc:"Destinou para saúde, o prefeito executou em outra coisa ou deixou parado. Perdeu controle do ativo." },
      { icone:"🗺️", titulo:"Não sabe onde ainda tem saldo", desc:"Tem emendas de anos anteriores com saldo residual que ninguém está olhando." },
      { icone:"🔁", titulo:"Devolução que mancha o histórico", desc:"Emenda devolvida aparece nos dados públicos. Qualquer jornalista ou adversário pode encontrar." },
      { icone:"🤔", titulo:"Não sabe qual OSC é confiável", desc:"Quer indicar uma OSC mas não sabe se ela está habilitada, se tem Transferegov, se vai executar direito." },
    ],

    desejos: [
      { icone:"🗺️", titulo:"Ver TUDO que tem parado no seu nome", desc:"Mapa completo: quanto empenhado, quanto pago, onde está parado, qual o prazo de cada um." },
      { icone:"🎯", titulo:"Controlar para onde vai", desc:"Definir município, OSC e área temática — e ter certeza de que vai ser executado com sua marca." },
      { icone:"📅", titulo:"Alerta antes do prazo vencer", desc:"Ser avisado com 90, 60 e 30 dias antes. Tempo de acionar quem precisa acionar." },
      { icone:"🤝", titulo:"Ter uma OSC de confiança como parceira", desc:"Uma OSC que ele confia politicamente, que executa bem e que coloca o nome dele na placa." },
      { icone:"📊", titulo:"Relatório de impacto para usar na campanha", desc:"'Minha emenda atendeu 1.200 famílias em Lagarto.' Isso vira post, panfleto e discurso." },
    ],

    medos: [
      "Emenda devolvida virar notícia em 2026",
      "Prefeito rival usar a emenda contra ele",
      "CGU bloquear por irregularidade da OSC",
      "Adversário mostrar que suas emendas não executaram",
      "Perder base eleitoral por falta de entrega",
    ],

    pitchIdeal: "Deputado, você tem R$ X parado em emendas que vencem em dezembro. Eu monitoro todas, aciono as prefeituras certas, caso com OSCs habilitadas e garanto que cada centavo vira atendimento com seu nome. Você foca na campanha — eu cuido da execução.",

    gatilhos: [
      "Comece sempre mostrando o saldo TOTAL parado com ele",
      "Fale em 'visibilidade eleitoral' — não em 'execução orçamentária'",
      "Mostre o risco de devolução em 2026 (a pior notícia possível)",
      "Ofereça o relatório de impacto como produto separado",
    ],
  },

  {
    id: "senador",
    titulo: "SENADOR",
    subtitulo: "Parlamentar do Senado",
    icone: "⚖️",
    cor: "#8b5cf6",
    corEscura: "#6d28d9",
    avatar: "SN",
    tagline: "\"Tenho mandato de 8 anos — mas preciso de visibilidade agora\"",
    perfil: "Mandato de 8 anos, base eleitoral estadual — não municipal. Tem emendas maiores (R$ 52M+ por mandato). Pensa em governador ou segundo mandato. Mais sofisticado politicamente. Equipe maior, mas igualmente perdida na execução. Precisa atender o estado inteiro.",

    dores: [
      { icone:"🌎", titulo:"Base é o estado inteiro — impossível acompanhar tudo", desc:"Tem emendas em 50+ municípios. Não tem estrutura para monitorar cada uma. Muito saldo se perde." },
      { icone:"🎭", titulo:"Visibilidade diluída", desc:"Emenda no interior do estado não chega na capital. Ninguém sabe que foi ele. O impacto político se perde." },
      { icone:"🏛️", titulo:"Disputa com outros senadores pelo mesmo espaço", desc:"O município recebe emenda de 3 senadores. A entrega que aparece é a que tem alguém na execução." },
      { icone:"📋", titulo:"Prestação de contas é responsabilidade dele", desc:"Mesmo que o município execute mal, quem responde é ele. CGU bate na porta do senador." },
      { icone:"🗂️", titulo:"Emendas de bancada sem rastreamento", desc:"Emendas coletivas da bancada estadual ficam num limbo — ninguém sabe o status real." },
    ],

    desejos: [
      { icone:"🗺️", titulo:"Visão consolidada do estado inteiro", desc:"Dashboard único: todos os municípios, todos os saldos, todos os prazos, em uma tela." },
      { icone:"📡", titulo:"Alertas por estado, região ou eixo temático", desc:"'Senador, você tem R$ 4M parado em saúde no sul do estado.' Ação cirúrgica." },
      { icone:"🏆", titulo:"Ser reconhecido como quem traz mais recurso ao estado", desc:"O senador que mais executa vira referência. Isso tem peso eleitoral para governadoria." },
      { icone:"🤝", titulo:"Rede de OSCs estaduais confiáveis", desc:"Precisa de parceiros em todas as regiões do estado — não só na capital." },
      { icone:"📊", titulo:"Relatório estadual de impacto", desc:"'Minhas emendas atenderam 28 municípios e 45 mil pessoas.' Isso é campanha." },
    ],

    medos: [
      "Perder governadoria por baixo histórico de execução",
      "Outro senador aparecer com mais entregas na sua base",
      "Emenda devolvida virar manchete estadual",
      "OSC fantasma queimar seu nome",
      "Não conseguir provar impacto no interior",
    ],

    pitchIdeal: "Senador, você tem emendas em 23 municípios do estado e eu estimo que mais de 40% está subexecutado ou em risco de devolução. Eu entrego monitoramento estadual completo, rede de OSCs habilitadas e relatório de impacto por região. Você vira o parlamentar com melhor histórico de execução do estado.",

    gatilhos: [
      "Abordagem estadual — nunca municipal apenas",
      "Fale em legado e governadoria, não só em emenda",
      "Ofereça comparativo com outros senadores do estado",
      "O argumento de prestação de contas toca mais neles",
    ],
  },

  {
    id: "oscip",
    titulo: "OSCIP / OSC",
    subtitulo: "Organização da Sociedade Civil",
    icone: "🌱",
    cor: "#10b981",
    corEscura: "#059669",
    avatar: "OSC",
    tagline: "\"Temos capacidade de execução mas não conseguimos acessar os recursos\"",
    perfil: "Tem experiência com projetos sociais mas gasta metade do tempo em burocracia. Boa vontade de sobra, gestão financeira muitas vezes fraca. Depende de editais anuais para sobreviver. Tem medo do Transferegov. Precisa de projetos para pagar sua equipe.",

    dores: [
      { icone:"📝", titulo:"Passa mais tempo em burocracia do que em projeto", desc:"Cadastro, documentação, Transferegov, prestação de contas — tudo trava. A equipe se desgasta." },
      { icone:"💰", titulo:"Sobrevivência financeira depende de edital", desc:"Se não ganhar o edital, demite a equipe. Sem projeto, sem renda. Ciclo de insegurança permanente." },
      { icone:"🔍", titulo:"Não sabe onde tem recurso disponível para ela", desc:"Fica esperando edital público. Não sabe que tem emenda de deputado esperando exatamente o que ela faz." },
      { icone:"🤝", titulo:"Não tem conexão política para acessar emendas", desc:"A emenda existe, a OSCIP existe, mas ninguém fez a ponte. Falta o intermediário." },
      { icone:"📊", titulo:"Não sabe provar impacto de forma estruturada", desc:"Faz um trabalho incrível mas não consegue transformar em dados, indicadores e relatório." },
      { icone:"⚖️", titulo:"Medo de irregularidade e processo", desc:"Uma nota fiscal errada pode barrar toda a organização. Gestão financeira fragilizada pelo medo." },
    ],

    desejos: [
      { icone:"💼", titulo:"Projetos garantidos para o ano inteiro", desc:"Previsibilidade financeira. Saber que vai ter recurso para manter a equipe e o programa." },
      { icone:"🎯", titulo:"Ser encontrada por quem tem recurso", desc:"Ser 'descoberta' por um deputado que precisa executar exatamente o que ela faz. O sonho." },
      { icone:"🛡️", titulo:"Apoio técnico na burocracia", desc:"Alguém que cuida do Transferegov, da prestação de contas, dos documentos. Ela foca no projeto." },
      { icone:"📈", titulo:"Crescer de forma estruturada", desc:"Sair de uma OSC local para referência regional. Mais projetos, mais equipe, mais impacto." },
      { icone:"🏆", titulo:"Ser vista como execução de confiança", desc:"Virar a OSC que parlamentares e prefeitos buscam porque garantem entrega e prestação limpa." },
    ],

    medos: [
      "Ter o cadastro bloqueado por pendência documental",
      "Assinar convênio e não conseguir executar",
      "Prestação de contas reprovada pelo órgão repassador",
      "Perder a habilitação no Transferegov",
      "Depender de uma única fonte de recurso",
    ],

    pitchIdeal: "Você executa. Eu encontro o recurso, faço a ponte com o parlamentar ou prefeitura, estruturo o projeto, cuido da burocracia e garanto que a prestação de contas passa. Você aparece como a OSC que entrega. Eu fico nos bastidores.",

    gatilhos: [
      "Fale em segurança e previsibilidade — não em 'oportunidade'",
      "Mostre que você tira a burocracia das costas delas",
      "O argumento de ser 'encontrada' por parlamentares é poderoso",
      "Proponha parceria de longo prazo — não projeto único",
    ],
  },
];

const COMO_ENTRAR = [
  {
    cliente:"Prefeito",
    cor:"#0ea5e9",
    entrada:"Não chegue pedindo reunião. Chegue com o relatório pronto. Uma folha A4: 'Município de X tem R$ Y parados'. Isso abre a porta.",
    erroComum:"Falar de 'projeto' antes de mostrar o dinheiro perdido.",
    melhorMomento:"Pós-eleição (primeiros 6 meses) e pré-eleição (últimos 12 meses).",
  },
  {
    cliente:"Deputado",
    cor:"#f59e0b",
    entrada:"Acesse via assessor parlamentar. Leve o mapa de emendas dele com % de execução. Pergunte: 'Você sabia que tem R$ X parado com prazo em dezembro?'",
    erroComum:"Falar em 'captação' — isso soa como você vai pegar o dinheiro dele.",
    melhorMomento:"Janeiro–Março (início do ano orçamentário) e Setembro–Outubro (urgência de prazo).",
  },
  {
    cliente:"Senador",
    cor:"#8b5cf6",
    entrada:"A abordagem é mais formal. Precisa de carta de apresentação, dose de credencial. O diferencial é o mapa estadual — nenhum assessor tem isso consolidado.",
    erroComum:"Tratar como deputado — o senador quer visão estratégica, não operacional.",
    melhorMomento:"Quando há eleição para governador no horizonte.",
  },
  {
    cliente:"OSCIP",
    cor:"#10b981",
    entrada:"Aborde no momento de renovação de convênio ou quando ela perdeu um edital. Dor fresca abre conversa.",
    erroComum:"Prometer recurso — você não garante aprovação, garante estruturação.",
    melhorMomento:"Fim de ano (quando editais fecham e elas ficam sem projeto para o próximo ano).",
  },
];

export default function PersonasClientes() {
  const [sel, setSel] = useState("prefeito");
  const [abaSec, setAbaSec] = useState("dores");
  const [mostrarEntrada, setMostrarEntrada] = useState(false);

  const persona = PERSONAS.find(p => p.id === sel);

  return (
    <div style={{
      fontFamily:"'Georgia', serif",
      background:"#fafaf8",
      minHeight:"100vh",
      color:"#1a1a1a",
    }}>

      {/* HEADER */}
      <div style={{
        background:"#111827",
        padding:"24px 36px",
        borderBottom:`4px solid ${persona.cor}`,
      }}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{fontSize:11,color:"#6b7280",letterSpacing:4,textTransform:"uppercase",marginBottom:6}}>
            Inteligência de Subexecução
          </div>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
            <div>
              <h1 style={{fontSize:22,fontWeight:700,color:"#f9fafb",margin:0,letterSpacing:-0.5}}>
                Quem é o seu cliente.<br/>
                <span style={{color:persona.cor}}>O que ele sente. O que ele quer ouvir.</span>
              </h1>
            </div>
            <div style={{fontSize:11,color:"#4b5563",fontStyle:"italic"}}>
              A venda começa aqui — antes de qualquer tecnologia
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 36px"}}>

        {/* Seletor de persona */}
        <div style={{display:"flex",gap:12,marginBottom:28}}>
          {PERSONAS.map(p => (
            <button key={p.id} onClick={()=>{ setSel(p.id); setAbaSec("dores"); }}
              style={{
                flex:1,
                background:sel===p.id ? p.cor : "#fff",
                border:`2px solid ${sel===p.id ? p.cor : "#e5e7eb"}`,
                borderRadius:10,
                padding:"16px 12px",
                cursor:"pointer",
                fontFamily:"inherit",
                transition:"all 0.2s",
                boxShadow: sel===p.id ? `0 4px 20px ${p.cor}40` : "0 1px 4px #0001",
              }}>
              <div style={{fontSize:22,marginBottom:6}}>{p.icone}</div>
              <div style={{fontSize:12,fontWeight:700,color:sel===p.id?"#fff":"#374151"}}>{p.titulo}</div>
              <div style={{fontSize:10,color:sel===p.id?"#ffffffaa":"#9ca3af",marginTop:2}}>{p.subtitulo}</div>
            </button>
          ))}
        </div>

        {/* Tagline */}
        <div style={{
          background:`linear-gradient(135deg, ${persona.cor}15, ${persona.cor}08)`,
          border:`1px solid ${persona.cor}44`,
          borderLeft:`5px solid ${persona.cor}`,
          borderRadius:10,
          padding:"18px 24px",
          marginBottom:24,
        }}>
          <div style={{fontSize:18,fontStyle:"italic",color:"#111827",marginBottom:10,lineHeight:1.5}}>
            {persona.tagline}
          </div>
          <div style={{fontSize:12,color:"#6b7280",lineHeight:1.8}}>{persona.perfil}</div>
        </div>

        {/* Sub-abas */}
        <div style={{display:"flex",gap:0,marginBottom:24,borderBottom:"2px solid #e5e7eb"}}>
          {[
            {id:"dores",    label:"😰 Dores e Frustrações"},
            {id:"desejos",  label:"🎯 O que Ele Quer"},
            {id:"medos",    label:"👻 Medos Profundos"},
            {id:"pitch",    label:"🗣️ Como Falar com Ele"},
          ].map(a => (
            <button key={a.id} onClick={()=>setAbaSec(a.id)}
              style={{
                background:"transparent",border:"none",
                borderBottom:abaSec===a.id?`3px solid ${persona.cor}`:"3px solid transparent",
                color:abaSec===a.id?persona.corEscura:"#6b7280",
                padding:"10px 20px",cursor:"pointer",fontFamily:"inherit",
                fontSize:12,fontWeight:abaSec===a.id?700:400,
                marginBottom:-2,transition:"all 0.15s",
              }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* DORES */}
        {abaSec==="dores" && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
            {persona.dores.map((d,i) => (
              <div key={i} style={{
                background:"#fff",border:"1px solid #e5e7eb",
                borderTop:`3px solid ${persona.cor}`,
                borderRadius:10,padding:"18px 20px",
                boxShadow:"0 1px 6px #0000080a",
              }}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <span style={{fontSize:22,flexShrink:0}}>{d.icone}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#111827",marginBottom:6}}>{d.titulo}</div>
                    <div style={{fontSize:12,color:"#6b7280",lineHeight:1.7}}>{d.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DESEJOS */}
        {abaSec==="desejos" && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
            {persona.desejos.map((d,i) => (
              <div key={i} style={{
                background:"#fff",
                border:`1px solid ${persona.cor}33`,
                borderTop:`3px solid ${persona.cor}`,
                borderRadius:10,padding:"18px 20px",
                boxShadow:`0 2px 12px ${persona.cor}15`,
              }}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <span style={{fontSize:22,flexShrink:0}}>{d.icone}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#111827",marginBottom:6}}>{d.titulo}</div>
                    <div style={{fontSize:12,color:"#6b7280",lineHeight:1.7}}>{d.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MEDOS */}
        {abaSec==="medos" && (
          <div style={{
            background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,
            padding:24,boxShadow:"0 1px 6px #0000080a",
          }}>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:18,fontStyle:"italic"}}>
              Esses medos são o verdadeiro gatilho de compra. Quando você toca neles com cuidado — e mostra que os elimina — a conversa muda de patamar.
            </div>
            {persona.medos.map((m,i) => (
              <div key={i} style={{
                display:"flex",alignItems:"center",gap:14,
                padding:"14px 18px",borderRadius:8,marginBottom:8,
                background:`linear-gradient(90deg, ${persona.cor}10, transparent)`,
                border:`1px solid ${persona.cor}22`,
              }}>
                <div style={{
                  width:28,height:28,borderRadius:"50%",
                  background:persona.cor+"20",border:`1px solid ${persona.cor}44`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11,fontWeight:900,color:persona.cor,flexShrink:0,
                }}>{i+1}</div>
                <span style={{fontSize:13,color:"#374151"}}>{m}</span>
              </div>
            ))}
          </div>
        )}

        {/* PITCH */}
        {abaSec==="pitch" && (
          <div>
            <div style={{
              background:"#111827",borderRadius:12,padding:28,
              marginBottom:20,
              border:`2px solid ${persona.cor}`,
              boxShadow:`0 8px 32px ${persona.cor}30`,
            }}>
              <div style={{fontSize:10,color:persona.cor,letterSpacing:3,fontFamily:"monospace",marginBottom:14}}>
                FRASE DE ABERTURA — USE EXATAMENTE ASSIM
              </div>
              <div style={{fontSize:16,color:"#f9fafb",lineHeight:1.8,fontStyle:"italic"}}>
                "{persona.pitchIdeal}"
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:20}}>
                <div style={{fontSize:11,color:persona.cor,letterSpacing:2,fontWeight:700,marginBottom:14,fontFamily:"monospace"}}>
                  ✅ GATILHOS QUE FUNCIONAM
                </div>
                {persona.gatilhos.map((g,i) => (
                  <div key={i} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
                    <span style={{color:persona.cor,fontSize:14,flexShrink:0,marginTop:2}}>→</span>
                    <span style={{fontSize:12,color:"#374151",lineHeight:1.6}}>{g}</span>
                  </div>
                ))}
              </div>
              <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:20}}>
                {COMO_ENTRAR.filter(c=>c.cliente===persona.titulo.split(" ")[0]||persona.titulo.includes(c.cliente)).map((c,i) => (
                  <div key={i}>
                    <div style={{fontSize:11,color:"#6b7280",letterSpacing:2,fontWeight:700,marginBottom:10,fontFamily:"monospace"}}>
                      🚪 COMO ENTRAR
                    </div>
                    <p style={{fontSize:12,color:"#374151",lineHeight:1.7,marginBottom:14}}>{c.entrada}</p>
                    <div style={{fontSize:11,color:"#6b7280",letterSpacing:2,fontWeight:700,marginBottom:8,fontFamily:"monospace"}}>
                      ⏰ MELHOR MOMENTO
                    </div>
                    <p style={{fontSize:12,color:"#374151",lineHeight:1.7,marginBottom:14}}>{c.melhorMomento}</p>
                    <div style={{fontSize:11,color:"#ef4444",letterSpacing:2,fontWeight:700,marginBottom:8,fontFamily:"monospace"}}>
                      ❌ ERRO MAIS COMUM
                    </div>
                    <p style={{fontSize:12,color:"#374151",lineHeight:1.7}}>{c.erroComum}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Comparativo transversal */}
        <div style={{
          marginTop:32,background:"#111827",borderRadius:12,padding:24,
        }}>
          <div style={{fontSize:11,color:"#9ca3af",letterSpacing:3,fontFamily:"monospace",marginBottom:18}}>
            O QUE TODOS ELES TÊM EM COMUM — SEU POSICIONAMENTO UNIVERSAL
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
            {[
              { icone:"💰", titulo:"Dinheiro perdido", desc:"Todos têm recurso parado que não sabem identificar sozinhos." },
              { icone:"⏱️", titulo:"Prazo como inimigo", desc:"O tempo corre contra todos. Você é o alerta antecipado." },
              { icone:"🛡️", titulo:"Medo de errar", desc:"Todos querem executar sem processo. Você é a proteção." },
              { icone:"🏆", titulo:"Visibilidade", desc:"Todos querem aparecer fazendo. Você garante a entrega e a foto." },
            ].map((item,i) => (
              <div key={i} style={{
                background:"#1f2937",borderRadius:8,padding:"16px 14px",
                border:"1px solid #374151",
              }}>
                <div style={{fontSize:20,marginBottom:8}}>{item.icone}</div>
                <div style={{fontSize:12,fontWeight:700,color:"#f9fafb",marginBottom:6}}>{item.titulo}</div>
                <div style={{fontSize:11,color:"#9ca3af",lineHeight:1.6}}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop:18,padding:"14px 18px",
            background:"#0f172a",borderRadius:8,
            borderLeft:`4px solid #f59e0b`,
          }}>
            <span style={{fontSize:12,color:"#fbbf24",fontWeight:700,fontFamily:"monospace"}}>
              SEU POSICIONAMENTO DEFINITIVO:{" "}
            </span>
            <span style={{fontSize:13,color:"#e5e7eb",fontStyle:"italic"}}>
              "Eu não faço projeto. Eu encontro o dinheiro que você está perdendo, estruturo a execução e garanto que aparece com seu nome — limpo, dentro do prazo, aprovado."
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
