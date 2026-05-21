// src/lib/pdf/briefing-pdf.tsx
// Node.js only — used by generateBriefing.tsx via renderToBuffer
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { MunicipioRecomendado } from '@/types'
import { brl } from '@/lib/format'

const styles = StyleSheet.create({
  page:         { padding: 48, fontFamily: 'Helvetica', backgroundColor: '#ffffff', color: '#1e293b' },
  brand:        { fontSize: 9, color: '#0284c7', letterSpacing: 2, marginBottom: 4 },
  title:        { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4 },
  subtitle:     { fontSize: 11, color: '#64748b' },
  divider:      { borderBottom: 1, borderColor: '#e2e8f0', marginVertical: 16 },
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0284c7', letterSpacing: 1, marginBottom: 8 },
  body:         { fontSize: 10, lineHeight: 1.6, color: '#334155' },
  summaryRow:   { flexDirection: 'row', gap: 24, marginTop: 8 },
  summaryBox:   { flex: 1 },
  summaryLabel: { fontSize: 9, color: '#64748b', marginBottom: 2 },
  summaryValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  summaryRisk:  { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#ef4444' },
  tableHeader:  { flexDirection: 'row', borderBottom: 2, borderColor: '#0284c7', paddingBottom: 4, marginBottom: 2 },
  tableRow:     { flexDirection: 'row', borderBottom: 1, borderColor: '#f1f5f9', paddingVertical: 5 },
  colNum:       { width: '8%',  fontSize: 9, color: '#64748b' },
  col50:        { width: '50%', fontSize: 9, color: '#334155' },
  col22:        { width: '22%', fontSize: 9, color: '#334155', textAlign: 'right' },
  col20:        { width: '20%', fontSize: 9, color: '#334155', textAlign: 'right' },
  colHead:      { fontFamily: 'Helvetica-Bold', color: '#64748b', fontSize: 9 },
  disclaimer:   { marginTop: 24, fontSize: 8, color: '#94a3b8', fontStyle: 'italic' },
  footer:       { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
})


export interface BriefingPDFProps {
  parlamentarNome: string
  valorTotalEmendas: number
  valorEmRisco: number
  percentualExecutado: number
  top5Municipios: MunicipioRecomendado[]
  textoIA: string
  geradoEm: string
}

export function BriefingPDF({
  parlamentarNome,
  valorTotalEmendas,
  valorEmRisco,
  percentualExecutado,
  top5Municipios,
  textoIA,
  geradoEm,
}: BriefingPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.section}>
          <Text style={styles.brand}>NEXA RADAR</Text>
          <Text style={styles.title}>Briefing Parlamentar</Text>
          <Text style={styles.subtitle}>{parlamentarNome}</Text>
          <Text style={{ ...styles.subtitle, marginTop: 2, fontSize: 9 }}>
            Gerado em {geradoEm}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Resumo financeiro */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SITUAÇÃO DAS EMENDAS</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Total de emendas individuais</Text>
              <Text style={styles.summaryValue}>{brl(valorTotalEmendas)}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Percentual executado</Text>
              <Text style={styles.summaryValue}>{percentualExecutado.toFixed(1)}%</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Em risco de devolução</Text>
              <Text style={styles.summaryRisk}>{brl(valorEmRisco)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Municípios recomendados */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MUNICÍPIOS PRIORITÁRIOS</Text>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.colNum, ...styles.colHead }}>#</Text>
            <Text style={{ ...styles.col50, ...styles.colHead }}>Município</Text>
            <Text style={{ ...styles.col22, ...styles.colHead }}>Score</Text>
            <Text style={{ ...styles.col20, ...styles.colHead }}>CAUC</Text>
          </View>
          {top5Municipios.map((m, i) => (
            <View key={m.ibge} style={styles.tableRow}>
              <Text style={styles.colNum}>{i + 1}</Text>
              <View style={{ width: '50%' }}>
                <Text style={{ ...styles.col50, width: '100%' }}>{m.nome}</Text>
                <Text style={{ fontSize: 7, color: '#94a3b8', marginTop: 1 }}>{m.justificativa}</Text>
              </View>
              <Text style={styles.col22}>{m.score_total}/100</Text>
              <Text style={styles.col20}>{m.justificativa.includes('CAUC regular') ? '✓' : '—'}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Análise IA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ANÁLISE E RECOMENDAÇÕES</Text>
          <Text style={styles.body}>{textoIA}</Text>
        </View>

        <Text style={styles.disclaimer}>
          Gerado por inteligência artificial — revisar com equipe antes de usar.
        </Text>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
