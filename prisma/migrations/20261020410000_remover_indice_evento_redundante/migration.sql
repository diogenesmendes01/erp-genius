-- Índice redundante (#271): "Evento_agregadoTipo_agregadoId_idx" (agregadoTipo, agregadoId) é prefixo de
-- "Evento_agregadoTipo_agregadoId_criadoEm_idx" (agregadoTipo, agregadoId, criadoEm), criado pela migration
-- 20261020400000_evento_agregado_criado_em_idx. Toda consulta que usava o antigo é servida pelo novo, e nenhuma
-- constraint (unique/PK/FK) depende dele. Tirá-lo poupa espaço e escrita em todo INSERT de Evento.
-- CONCURRENTLY não trava escrita em "Evento"; é o único comando da migration porque não roda dentro de transação.
DROP INDEX CONCURRENTLY IF EXISTS "Evento_agregadoTipo_agregadoId_idx";
