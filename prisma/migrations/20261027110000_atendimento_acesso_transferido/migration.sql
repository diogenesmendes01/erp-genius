-- CreateTable
CREATE TABLE "AtendimentoAcessoTransferido" (
    "id" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "concedenteId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "AtendimentoAcessoTransferido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtendimentoAcessoTransferido_atendimentoId_usuarioId_revogadoEm_idx" ON "AtendimentoAcessoTransferido"("atendimentoId", "usuarioId", "revogadoEm");

-- CreateIndex
CREATE INDEX "AtendimentoAcessoTransferido_usuarioId_revogadoEm_idx" ON "AtendimentoAcessoTransferido"("usuarioId", "revogadoEm");

-- AddForeignKey
ALTER TABLE "AtendimentoAcessoTransferido" ADD CONSTRAINT "AtendimentoAcessoTransferido_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "AtendimentoWhatsApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoAcessoTransferido" ADD CONSTRAINT "AtendimentoAcessoTransferido_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoAcessoTransferido" ADD CONSTRAINT "AtendimentoAcessoTransferido_concedenteId_fkey" FOREIGN KEY ("concedenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "AtendimentoAcessoTransferido_ativo_key" ON "AtendimentoAcessoTransferido"("atendimentoId", "usuarioId") WHERE "revogadoEm" IS NULL;

CREATE FUNCTION revogar_acesso_transferido_atendimento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_usuario text;
BEGIN
  FOR v_usuario IN
    UPDATE "AtendimentoAcessoTransferido" SET "revogadoEm" = CURRENT_TIMESTAMP
    WHERE "atendimentoId" = NEW."id" AND "revogadoEm" IS NULL
      AND (NEW."encerradoEm" IS NOT NULL OR NEW."finalidade" <> 'COMERCIAL' OR NEW."responsavelId" IS DISTINCT FROM "usuarioId")
    RETURNING "usuarioId"
  LOOP
    PERFORM pg_notify('inbox_eventos', json_build_object('tipo', 'atendimento.atualizado', 'atendimentoId', NEW."id", 'mensagemId', NULL, 'conversaId', NEW."conversaId", 'paraUsuarioId', v_usuario)::text);
  END LOOP;
  RETURN NULL;
END $$;

CREATE TRIGGER revogar_acesso_transferido_atendimento AFTER UPDATE OF "responsavelId", "encerradoEm", "finalidade" ON "AtendimentoWhatsApp"
  FOR EACH ROW
  WHEN (OLD."responsavelId" IS DISTINCT FROM NEW."responsavelId" OR OLD."encerradoEm" IS DISTINCT FROM NEW."encerradoEm" OR OLD."finalidade" IS DISTINCT FROM NEW."finalidade")
  EXECUTE FUNCTION revogar_acesso_transferido_atendimento();

CREATE FUNCTION revogar_acesso_transferido_usuario() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_atendimento text;
  v_conversa text;
BEGIN
  FOR v_atendimento, v_conversa IN
    UPDATE "AtendimentoAcessoTransferido" t SET "revogadoEm" = CURRENT_TIMESTAMP
    FROM "AtendimentoWhatsApp" a
    WHERE t."usuarioId" = NEW."id" AND t."revogadoEm" IS NULL AND a."id" = t."atendimentoId"
    RETURNING a."id", a."conversaId"
  LOOP
    PERFORM pg_notify('inbox_eventos', json_build_object('tipo', 'atendimento.atualizado', 'atendimentoId', v_atendimento, 'mensagemId', NULL, 'conversaId', v_conversa, 'paraUsuarioId', NEW."id")::text);
  END LOOP;
  RETURN NULL;
END $$;

CREATE TRIGGER revogar_acesso_transferido_usuario AFTER UPDATE OF "ativo", "papeis" ON "Usuario"
  FOR EACH ROW
  WHEN (NOT NEW."ativo" OR NOT (NEW."papeis" && ARRAY['VENDEDOR', 'GERENTE_COMERCIAL']::"Papel"[]))
  EXECUTE FUNCTION revogar_acesso_transferido_usuario();
