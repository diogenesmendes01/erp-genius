-- Idempotência das ações de criação (#166, C1 da revisão do #240): `repeticaoIdempotente` procura o Evento de
-- criação por tipo + autor + payload->>'chaveIdempotencia'. Sem este índice, cada criação com chave percorria
-- todos os Eventos do mesmo tipo e filtrava o JSON.
-- Índice de expressão PARCIAL, em SQL manual: o Prisma 5 não representa expressão nem predicado, e o
-- `prisma migrate diff` não o enxerga (não propõe removê-lo). Só entram os Eventos que têm a chave, então o
-- índice fica pequeno. A consulta (src/server/_shared/idempotencia.ts) repete a expressão e o predicado.
CREATE INDEX "Evento_idempotencia_idx" ON "Evento" ("tipo", "autorId", (("payload" ->> 'chaveIdempotencia'))) WHERE "payload" ? 'chaveIdempotencia';
