CREATE UNIQUE INDEX "cobranca_id_matricula_key" ON "Cobranca"("id", "matriculaId");
CREATE TYPE "EstadoDiaCompensacao" AS ENUM ('PENDENTE', 'RECOMPOSTO', 'LIQUIDADO_FINANCEIRAMENTE');
CREATE TABLE "CompensacaoCoberturaMatricula" (
 "id" TEXT PRIMARY KEY, "matriculaId" TEXT NOT NULL, "cobrancaOrigemId" TEXT NOT NULL,
 "preparadorId" TEXT NOT NULL, "decisorId" TEXT, "status" "StatusAprovacao" NOT NULL DEFAULT 'PENDENTE',
 "motivo" TEXT NOT NULL, "evidenciaCondicoes" TEXT NOT NULL, "diasPropostos" JSONB NOT NULL,
 "coberturaOriginalInicio" DATE NOT NULL, "coberturaOriginalFim" DATE NOT NULL,
 "valorCoberturaOriginal" DECIMAL(12,2) NOT NULL, "moeda" TEXT NOT NULL, "cobrancaVersao" INTEGER NOT NULL,
 "motivoDecisao" TEXT, "decididaEm" TIMESTAMP(3), "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("cobrancaOrigemId", "matriculaId") REFERENCES "Cobranca"("id", "matriculaId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CHECK ("valorCoberturaOriginal" >= 0 AND "cobrancaVersao" >= 0 AND "coberturaOriginalFim" >= "coberturaOriginalInicio"),
 CHECK ("decisorId" IS NULL OR "decisorId" <> "preparadorId"),
 CHECK (("status" = 'PENDENTE' AND "decisorId" IS NULL AND "decididaEm" IS NULL AND "motivoDecisao" IS NULL)
 OR ("status" <> 'PENDENTE' AND "decisorId" IS NOT NULL AND "decididaEm" IS NOT NULL AND "motivoDecisao" IS NOT NULL AND length(trim("motivoDecisao")) >= 5)),
 CHECK (jsonb_typeof("diasPropostos") = 'array')
);
CREATE UNIQUE INDEX "compensacao_id_matricula_key" ON "CompensacaoCoberturaMatricula"("id", "matriculaId");
CREATE INDEX "CompensacaoCoberturaMatricula_matriculaId_status_idx" ON "CompensacaoCoberturaMatricula"("matriculaId", "status");
CREATE TABLE "DiaCompensacaoCobertura" (
 "id" TEXT PRIMARY KEY, "compensacaoId" TEXT NOT NULL, "matriculaId" TEXT NOT NULL, "diaOrigem" DATE NOT NULL,
 "estado" "EstadoDiaCompensacao" NOT NULL DEFAULT 'PENDENTE', "destinacaoReferencia" TEXT, "destinadoEm" TIMESTAMP(3), "versao" INTEGER NOT NULL DEFAULT 1,
 FOREIGN KEY ("compensacaoId", "matriculaId") REFERENCES "CompensacaoCoberturaMatricula"("id", "matriculaId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CHECK ("versao" > 0),
 CHECK (("estado" = 'PENDENTE' AND "destinacaoReferencia" IS NULL AND "destinadoEm" IS NULL)
 OR ("estado" <> 'PENDENTE' AND "destinacaoReferencia" IS NOT NULL AND length(trim("destinacaoReferencia")) > 0 AND "destinadoEm" IS NOT NULL))
);
CREATE UNIQUE INDEX "dia_compensacao_matricula_origem_key" ON "DiaCompensacaoCobertura"("matriculaId", "diaOrigem");
CREATE INDEX "DiaCompensacaoCobertura_compensacaoId_estado_idx" ON "DiaCompensacaoCobertura"("compensacaoId", "estado");

CREATE FUNCTION validar_origem_dia_compensacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origem "CompensacaoCoberturaMatricula";
BEGIN
 SELECT * INTO origem FROM "CompensacaoCoberturaMatricula" WHERE id = NEW."compensacaoId" FOR SHARE;
 IF origem.id IS NULL OR origem.status <> 'APROVADA'
 OR NEW."diaOrigem" < origem."coberturaOriginalInicio" OR NEW."diaOrigem" > origem."coberturaOriginalFim"
 OR NOT (origem."diasPropostos" ? to_char(NEW."diaOrigem", 'YYYY-MM-DD')) THEN
   RAISE EXCEPTION 'Dia exige origem aprovada e pertencimento ao período e à proposta';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dia_compensacao_origem BEFORE INSERT OR UPDATE ON "DiaCompensacaoCobertura"
 FOR EACH ROW EXECUTE FUNCTION validar_origem_dia_compensacao();
