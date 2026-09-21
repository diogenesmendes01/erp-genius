-- CreateEnum
CREATE TYPE "EstadoEnvioAssinatura" AS ENUM ('PREPARADO', 'ENVIANDO', 'ENVIO_INCERTO', 'ENVIADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "ProcessoAssinaturaContratual" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "artefatoId" TEXT NOT NULL,
    "conferenciaId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "fornecedor" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "estado" "EstadoEnvioAssinatura" NOT NULL DEFAULT 'PREPARADO',
    "referenciaExterna" TEXT,
    "tentativaAtual" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessoAssinaturaContratual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativaEnvioAssinatura" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "revisaoHash" TEXT NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaEnvioAssinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservacaoEnvioAssinatura" (
    "id" TEXT NOT NULL,
    "tentativaId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "referenciaExterna" TEXT,
    "evidenciaHash" TEXT NOT NULL,
    "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservacaoEnvioAssinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessoAssinaturaContratual_matriculaId_idx" ON "ProcessoAssinaturaContratual"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessoAssinaturaContratual_fornecedor_ambiente_referencia_key" ON "ProcessoAssinaturaContratual"("fornecedor", "ambiente", "referenciaExterna");

-- CreateIndex
CREATE UNIQUE INDEX "TentativaEnvioAssinatura_processoId_numero_key" ON "TentativaEnvioAssinatura"("processoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ObservacaoEnvioAssinatura_tentativaId_chave_key" ON "ObservacaoEnvioAssinatura"("tentativaId", "chave");

-- AddForeignKey
ALTER TABLE "ProcessoAssinaturaContratual" ADD CONSTRAINT "ProcessoAssinaturaContratual_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProcessoAssinaturaContratual" ADD CONSTRAINT "ProcessoAssinaturaContratual_artefatoId_fkey" FOREIGN KEY ("artefatoId") REFERENCES "ArtefatoContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProcessoAssinaturaContratual" ADD CONSTRAINT "ProcessoAssinaturaContratual_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES "ConferenciaAssinaturaContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProcessoAssinaturaContratual" ADD CONSTRAINT "ProcessoAssinaturaContratual_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TentativaEnvioAssinatura" ADD CONSTRAINT "TentativaEnvioAssinatura_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "ProcessoAssinaturaContratual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ObservacaoEnvioAssinatura" ADD CONSTRAINT "ObservacaoEnvioAssinatura_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES "TentativaEnvioAssinatura"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX processo_assinatura_ativo_matricula ON "ProcessoAssinaturaContratual" ("matriculaId") WHERE estado <> 'CANCELADO';
CREATE FUNCTION preservar_base_processo_assinatura() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Processo de assinatura preserva histórico'; END IF;
 IF TG_OP = 'UPDATE' AND (NEW.id,NEW."matriculaId",NEW."artefatoId",NEW."conferenciaId",NEW."preparadorId",NEW.fornecedor,NEW.ambiente,NEW."criadoEm") IS DISTINCT FROM (OLD.id,OLD."matriculaId",OLD."artefatoId",OLD."conferenciaId",OLD."preparadorId",OLD.fornecedor,OLD.ambiente,OLD."criadoEm") THEN RAISE EXCEPTION 'Base do processo de assinatura é imutável'; END IF;
 IF TG_OP = 'UPDATE' AND OLD."referenciaExterna" IS NOT NULL AND NEW."referenciaExterna" IS DISTINCT FROM OLD."referenciaExterna" THEN RAISE EXCEPTION 'Referência externa não pode ser substituída'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "ArtefatoContratual" a JOIN "PreviaDocumentoContratual" p ON p.id=a."previaId" JOIN "ConferenciaAssinaturaContratual" c ON c."artefatoId"=a.id WHERE a.id=NEW."artefatoId" AND p."matriculaId"=NEW."matriculaId" AND c.id=NEW."conferenciaId") THEN RAISE EXCEPTION 'Processo precisa do original e da conferência da mesma matrícula'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_base_processo_assinatura BEFORE INSERT OR UPDATE OR DELETE ON "ProcessoAssinaturaContratual" FOR EACH ROW EXECUTE FUNCTION preservar_base_processo_assinatura();
CREATE FUNCTION preservar_historico_envio_assinatura() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Histórico de envio de assinatura é imutável'; END; $$;
CREATE TRIGGER preservar_tentativa_assinatura BEFORE UPDATE OR DELETE ON "TentativaEnvioAssinatura" FOR EACH ROW EXECUTE FUNCTION preservar_historico_envio_assinatura();
CREATE TRIGGER preservar_observacao_assinatura BEFORE UPDATE OR DELETE ON "ObservacaoEnvioAssinatura" FOR EACH ROW EXECUTE FUNCTION preservar_historico_envio_assinatura();
ALTER TABLE "ProcessoAssinaturaContratual" ADD CONSTRAINT processo_ambiente CHECK (ambiente IN ('SANDBOX','PRODUCAO') AND "tentativaAtual" >= 0);
ALTER TABLE "TentativaEnvioAssinatura" ADD CONSTRAINT tentativa_numero_positivo CHECK (numero > 0);
ALTER TABLE "ObservacaoEnvioAssinatura" ADD CONSTRAINT observacao_resultado_valido CHECK (resultado IN ('INCERTO','REGISTRADO','NAO_CRIADO') AND (resultado <> 'REGISTRADO' OR "referenciaExterna" IS NOT NULL));
