-- supabase/migrations/003_indexes.sql

-- GIN para queries em arrays de programas
CREATE INDEX idx_habilitacao_programas
  ON municipios_habilitacao USING GIN(programas_habilitados);
CREATE INDEX idx_habilitacao_programas_bloqueados
  ON municipios_habilitacao USING GIN(programas_bloqueados);

-- Transferências — buscas frequentes por município, programa e prazo
CREATE INDEX idx_transferencias_ibge    ON transferencias_federais(municipio_ibge);
CREATE INDEX idx_transferencias_programa ON transferencias_federais(programa);
CREATE INDEX idx_transferencias_prazo   ON transferencias_federais(prazo_limite)
  WHERE prazo_limite IS NOT NULL;
CREATE INDEX idx_transferencias_comp    ON transferencias_federais(competencia);

-- Emendas — buscas por parlamentar, município e exercício
CREATE INDEX idx_emendas_parlamentar ON emendas_parlamentares(parlamentar_id);
CREATE INDEX idx_emendas_municipio   ON emendas_parlamentares(municipio_ibge);
CREATE INDEX idx_emendas_tipo        ON emendas_parlamentares(parlamentar_tipo);
CREATE INDEX idx_emendas_exercicio   ON emendas_parlamentares(exercicio);

-- Diagnósticos e briefings — busca por status (alertas de 'gerando' travado)
CREATE INDEX idx_diagnosticos_ibge   ON diagnosticos(municipio_ibge);
CREATE INDEX idx_diagnosticos_status ON diagnosticos(status);
CREATE INDEX idx_briefings_parl      ON briefings(parlamentar_id);
CREATE INDEX idx_briefings_status    ON briefings(status);

-- Mapa político e scores
CREATE INDEX idx_mapa_parlamentar  ON mapa_politico(parlamentar_id);
CREATE INDEX idx_scores_parlamentar ON scores_municipio_parlamentar(parlamentar_id);
