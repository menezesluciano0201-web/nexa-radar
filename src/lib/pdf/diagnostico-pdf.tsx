// src/lib/pdf/diagnostico-pdf.tsx
// Node.js only — used by generateDiagnostico.tsx via renderToBuffer
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { ProgramaCritico } from '@/types'
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
  summaryRow:   { flexDirection: 'row', gap: 32, marginTop: 8 },
  summaryBox:   { flex: 1 },
  summaryLabel: { fontSize: 9, color: '#64748b', marginBottom: 2 },
  summaryValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  summaryRisk:  { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#ef4444' },
  tableHeader:  { flexDirection: 'row', borderBottom: 2, borderColor: '#0284c7', paddingBottom: 4, marginBottom: 2 },
  tableRow:     { flexDirection: 'row', borderBottom: 1, borderColor: '#f1f5f9', paddingVertical: 5 },
  col40:        { width: '40%', fontSize: 9, color: '#334155' },
  col20:        { width: '20%', fontSize: 9, color: '#334155', textAlign: 'right' },
  colHead:      { fontFamily: 'Helvetica-Bold', color: '#64748b', fontSize: 9 },
  colRisk:      { color: '#ef4444' },
  disclaimer:   { marginTop: 24, fontSize: 8, color: '#94a3b8', fontStyle: 'italic' },
  footer:       { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
})


export interface DiagnosticoPDFProps {
  municipioNome: string
  uf: string
  valorTotalIdentificado: number
  valorEmRisco: number
  programasCriticos: ProgramaCritico[]
  textoIA: string
  geradoEm: string
}

export function DiagnosticoPDF({
  municipioNome,
  uf,
  valorTotalIdentificado,
  valorEmRisco,
  programasCriticos,
  textoIA,
  geradoEm,
}: DiagnosticoPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.section}>
          <Text style={styles.brand}>NEXA RADAR</Text>
          <Text style={styles.title}>Diagnóstico de Subexecução</Text>
          <Text style={styles.subtitle}>{municipioNome} — {uf}</Text>
          <Text style={{ ...styles.subtitle, marginTop: 2, fontSize: 9 }}>
            Gerado em {geradoEm}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Resumo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESUMO EXECUTIVO</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Total identificado</Text>
              <Text style={styles.summaryValue}>{brl(valorTotalIdentificado, 2)}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Em risco de devolução</Text>
              <Text style={styles.summaryRisk}>{brl(valorEmRisco, 2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Tabela de programas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROGRAMAS COM SUBEXECUÇÃO</Text>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.col40, ...styles.colHead }}>Programa</Text>
            <Text style={{ ...styles.col20, ...styles.colHead }}>Empenhado</Text>
            <Text style={{ ...styles.col20, ...styles.colHead }}>Pago</Text>
            <Text style={{ ...styles.col20, ...styles.colHead }}>Execução</Text>
          </View>
          {programasCriticos.map((p, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col40}>{p.programa} ({p.fundo})</Text>
              <Text style={styles.col20}>{brl(p.valor_empenhado, 2)}</Text>
              <Text style={styles.col20}>{brl(p.valor_pago, 2)}</Text>
              <Text style={{ ...styles.col20, ...styles.colRisk }}>
                {p.percentual_execucao.toFixed(1)}%
              </Text>
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
          Este diagnóstico foi gerado por inteligência artificial e deve ser revisado
          por especialista antes de qualquer decisão.
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
