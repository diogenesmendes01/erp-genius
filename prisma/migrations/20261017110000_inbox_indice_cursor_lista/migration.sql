-- C3 (revisão do bloco D): o índice de cursor da lista deve casar com a ordenação
-- (ultimaMensagemEm DESC NULLS LAST, id DESC). O anterior era (DESC NULLS FIRST, id ASC) e não servia à consulta.
-- O Prisma não expressa NULLS LAST no schema; o schema declara sort: Desc e a ordem de nulos vive só aqui.

-- DropIndex
DROP INDEX "AtendimentoWhatsApp_ultimaMensagemEm_id_idx";

-- CreateIndex
CREATE INDEX "AtendimentoWhatsApp_ultimaMensagemEm_id_idx" ON "AtendimentoWhatsApp"("ultimaMensagemEm" DESC NULLS LAST, "id" DESC);
