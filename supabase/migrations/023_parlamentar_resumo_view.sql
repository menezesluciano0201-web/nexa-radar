-- Agrega emendas por parlamentar no banco, evitando fetch de 20k rows no servidor Next.js.
-- Acessado apenas via service-role (admin), que bypassa RLS.
CREATE VIEW parlamentar_resumo AS
SELECT
  parlamentar_id,
  MAX(parlamentar_nome) AS parlamentar_nome,
  SUM(valor_autorizado)::numeric AS total_autorizado,
  ARRAY_AGG(DISTINCT exercicio ORDER BY exercicio) AS exercicios
FROM emendas_parlamentares
GROUP BY parlamentar_id;
