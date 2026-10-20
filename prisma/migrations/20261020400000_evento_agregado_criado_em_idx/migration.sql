-- Último Evento por oportunidade (#262 B19, C2 da revisão): o funil ("tempo" e perdidos com período) e a carteira
-- fazem `MAX("criadoEm")` por (agregadoTipo, agregadoId). Com só `Evento(agregadoTipo, agregadoId)` o Postgres lê
-- todas as linhas do lead; com `criadoEm` no fim do índice o máximo sai de uma varredura reversa que para na
-- primeira linha (só no índice quando não há filtro de tipo). Medido em base sintética (1,8 mi de Eventos,
-- 2.500 leads com ~200 eventos cada): perdidos 30 dias do admin ~750 → ~130 ms, carteira do vendedor ~300 → ~140 ms.
-- ATENÇÃO: CREATE INDEX comum trava escrita em "Evento" durante a criação (~3 s por 1,8 mi de linhas na medição).
-- Rode o deploy fora de pico.
CREATE INDEX "Evento_agregadoTipo_agregadoId_criadoEm_idx" ON "Evento"("agregadoTipo", "agregadoId", "criadoEm");
