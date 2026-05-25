import 'server-only'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { TemplateConfig, SecoesProjeto, ProjetoInputs } from '@/types'

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b' },
  capa: { marginBottom: 32, borderBottom: '2pt solid #0f172a', paddingBottom: 16 },
  titulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  subtitulo: { fontSize: 12, color: '#475569', marginBottom: 4 },
  secao: { marginTop: 20, marginBottom: 8 },
  secaoTitulo: { fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: '#0f172a', borderBottom: '1pt solid #e2e8f0', paddingBottom: 4 },
  paragrafo: { lineHeight: 1.6, marginBottom: 6, textAlign: 'justify' },
  tabela: { marginTop: 8 },
  tabelaHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 6, fontWeight: 'bold' },
  tabelaRow: { flexDirection: 'row', padding: 5, borderBottom: '0.5pt solid #e2e8f0' },
  celula: { flex: 1, fontSize: 9 },
  celulaNarrow: { width: 60, fontSize: 9 },
  disclaimer: { marginTop: 24, padding: 10, backgroundColor: '#fef9c3', fontSize: 8, lineHeight: 1.5 },
  badge: { fontSize: 8, padding: '2 6', backgroundColor: '#dbeafe', color: '#1e40af', marginLeft: 8 },
})

interface Props {
  config: TemplateConfig
  secoes: SecoesProjeto
  municipioNome: string
  inputs: ProjetoInputs
}

export function ProjetoPDF({ config, secoes, municipioNome, inputs }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Capa */}
        <View style={styles.capa}>
          <Text style={styles.titulo}>{config.nome}</Text>
          <Text style={styles.subtitulo}>{municipioNome} — {config.orgao} / {config.fundo}</Text>
          <Text style={styles.subtitulo}>
            Valor solicitado: R$ {inputs.valor_solicitado.toLocaleString('pt-BR')} ·
            Prazo: {inputs.prazo_meses} meses ·
            Beneficiários: {inputs.num_beneficiarios}
          </Text>
          {inputs.oscip_executora && (
            <Text style={styles.subtitulo}>OSCIP executora: {inputs.oscip_executora}</Text>
          )}
        </View>

        {/* Seções narrativas */}
        {config.secoes.map(s => {
          const texto = secoes.secoes_texto?.[s.id]
          if (!texto) return null
          return (
            <View key={s.id} style={styles.secao}>
              <Text style={styles.secaoTitulo}>{s.titulo}</Text>
              <Text style={styles.paragrafo}>{texto}</Text>
            </View>
          )
        })}

        {/* Metas físicas */}
        {secoes.metas_fisicas?.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Metas Físicas</Text>
            <View style={styles.tabela}>
              <View style={styles.tabelaHeader}>
                <Text style={styles.celulaNarrow}>Trimestre</Text>
                <Text style={styles.celula}>Meta</Text>
                <Text style={styles.celulaNarrow}>Qtd.</Text>
              </View>
              {secoes.metas_fisicas.map((m, i) => (
                <View key={i} style={styles.tabelaRow}>
                  <Text style={styles.celulaNarrow}>{m.trimestre}º</Text>
                  <Text style={styles.celula}>{m.meta}</Text>
                  <Text style={styles.celulaNarrow}>{m.quantidade}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Indicadores */}
        {secoes.indicadores?.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Indicadores de Monitoramento</Text>
            <View style={styles.tabela}>
              <View style={styles.tabelaHeader}>
                <Text style={styles.celula}>Indicador</Text>
                <Text style={styles.celula}>Fórmula</Text>
                <Text style={styles.celulaNarrow}>Meta</Text>
              </View>
              {secoes.indicadores.map((ind, i) => (
                <View key={i} style={styles.tabelaRow}>
                  <Text style={styles.celula}>{ind.nome}</Text>
                  <Text style={styles.celula}>{ind.formula}</Text>
                  <Text style={styles.celulaNarrow}>{ind.meta}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Cronograma */}
        {secoes.cronograma?.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Cronograma de Execução</Text>
            <View style={styles.tabela}>
              <View style={styles.tabelaHeader}>
                <Text style={styles.celula}>Etapa</Text>
                <Text style={styles.celulaNarrow}>Início</Text>
                <Text style={styles.celulaNarrow}>Fim</Text>
              </View>
              {secoes.cronograma.map((c, i) => (
                <View key={i} style={styles.tabelaRow}>
                  <Text style={styles.celula}>{c.etapa}</Text>
                  <Text style={styles.celulaNarrow}>Mês {c.mes_inicio}</Text>
                  <Text style={styles.celulaNarrow}>Mês {c.mes_fim}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Orçamento */}
        {secoes.orcamento?.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Plano de Aplicação / Orçamento</Text>
            <View style={styles.tabela}>
              <View style={styles.tabelaHeader}>
                <Text style={styles.celulaNarrow}>Rubrica</Text>
                <Text style={styles.celula}>Descrição</Text>
                <Text style={styles.celulaNarrow}>Valor (R$)</Text>
              </View>
              {secoes.orcamento.map((o, i) => (
                <View key={i} style={styles.tabelaRow}>
                  <Text style={styles.celulaNarrow}>{o.rubrica}</Text>
                  <Text style={styles.celula}>{o.descricao}</Text>
                  <Text style={styles.celulaNarrow}>{o.valor.toLocaleString('pt-BR')}</Text>
                </View>
              ))}
              <View style={[styles.tabelaRow, { backgroundColor: '#f1f5f9' }]}>
                <Text style={styles.celulaNarrow}></Text>
                <Text style={[styles.celula, { fontWeight: 'bold' }]}>TOTAL</Text>
                <Text style={[styles.celulaNarrow, { fontWeight: 'bold' }]}>
                  {secoes.orcamento.reduce((a, o) => a + o.valor, 0).toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Declarações */}
        {secoes.declaracoes?.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Declarações</Text>
            {secoes.declaracoes.map((d, i) => (
              <Text key={i} style={[styles.paragrafo, { marginLeft: 12 }]}>• {d}</Text>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text>{config.disclaimer}</Text>
        </View>
      </Page>
    </Document>
  )
}
