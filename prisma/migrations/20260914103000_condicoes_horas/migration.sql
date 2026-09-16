-- CreateTable
CREATE TABLE "CondicoesHorasMatricula" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "regras" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "StatusCondicoesEncerramento" NOT NULL DEFAULT 'PENDENTE',
    "preparadorId" TEXT NOT NULL,
    "decisorId" TEXT,
    "motivoDecisao" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididaEm" TIMESTAMP(3),

    CONSTRAINT "CondicoesHorasMatricula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CondicoesHorasMatricula_matriculaId_status_idx" ON "CondicoesHorasMatricula"("matriculaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CondicoesHorasMatricula_matriculaId_versao_key" ON "CondicoesHorasMatricula"("matriculaId", "versao");

-- AddForeignKey
ALTER TABLE "CondicoesHorasMatricula" ADD CONSTRAINT "CondicoesHorasMatricula_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CondicoesHorasMatricula" ADD CONSTRAINT "CondicoesHorasMatricula_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CondicoesHorasMatricula" ADD CONSTRAINT "CondicoesHorasMatricula_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CondicoesHorasMatricula" ADD CONSTRAINT "CondicoesHorasMatricula_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE FUNCTION validar_condicoes_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m "Matricula"%ROWTYPE; u "Usuario"%ROWTYPE; anterior integer;
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Condições contratuais são preservadas.'; END IF;
 SELECT * INTO m FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
 IF TG_OP = 'INSERT' THEN
  IF NEW.status <> 'PENDENTE' OR NEW."decisorId" IS NOT NULL OR NEW."decididaEm" IS NOT NULL OR NEW."motivoDecisao" IS NOT NULL THEN RAISE EXCEPTION 'Prepare as condições antes da decisão.'; END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."preparadorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['SECRETARIA_ACADEMICA','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Sem permissão para preparar condições.'; END IF;
  IF EXISTS (SELECT 1 FROM "CondicoesHorasMatricula" WHERE "matriculaId"=m.id AND status='PENDENTE') THEN RAISE EXCEPTION 'Existe versão pendente.'; END IF;
  SELECT COALESCE(MAX(versao),0) INTO anterior FROM "CondicoesHorasMatricula" WHERE "matriculaId"=m.id;
  IF NEW.versao <> anterior+1 THEN RAISE EXCEPTION 'Versão contratual divergente.'; END IF;
 ELSE
  IF OLD.status <> 'PENDENTE' OR NEW.status NOT IN ('APROVADA','REJEITADA')
   OR (to_jsonb(OLD) - ARRAY['status','decisorId','decididaEm','motivoDecisao']) IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['status','decisorId','decididaEm','motivoDecisao'])
   THEN RAISE EXCEPTION 'Condições contratuais são preservadas.'; END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT ('ADMINISTRADOR'=ANY(u.papeis)) OR NEW."decisorId"=NEW."preparadorId" THEN RAISE EXCEPTION 'Outra pessoa da Administração deve decidir.'; END IF;
  IF NEW."decididaEm" IS NULL OR COALESCE(length(trim(NEW."motivoDecisao")),0)<5 THEN RAISE EXCEPTION 'Justifique a decisão.'; END IF;
 END IF;
 IF TG_OP='INSERT' OR NEW.status='APROVADA' THEN
  IF m."contratoOk" IS DISTINCT FROM true OR m."confirmacaoContratoEm" IS NULL OR m."contratoDocumentoId" IS DISTINCT FROM NEW."documentoId" THEN RAISE EXCEPTION 'Use o contrato confirmado da matrícula.'; END IF;
  PERFORM id FROM "Documento" WHERE id=NEW."documentoId" FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM "Documento" d WHERE d.id=NEW."documentoId" AND d.categoria='CONTRATO' AND NOT d.arquivado AND (d."matriculaId"=m.id OR d."leadId"=m."leadId")) THEN RAISE EXCEPTION 'Documento contratual indisponível.'; END IF;
  IF EXISTS (SELECT 1 FROM "PreparacaoComercialMatricula" WHERE "matriculaId"=m.id AND regime <> 'HORA_PARTICULAR') THEN RAISE EXCEPTION 'Condições exigem contratação por hora.'; END IF;
  IF NOT COALESCE(jsonb_typeof(NEW.regras)='object' AND NEW.regras ?& ARRAY['valorHora','moeda','unidadeMinutos','vigenteDesde','antecedenciaCancelamentoMinutos','clausulaPreco','clausulaCancelamento']
   AND (SELECT count(*) FROM jsonb_object_keys(NEW.regras))=7
   AND NEW.regras->>'valorHora' ~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'
   AND NEW.regras->>'moeda'=m.moeda AND NEW.regras->>'unidadeMinutos'='60'
   AND NEW.regras->>'antecedenciaCancelamentoMinutos' ~ '^[0-9]+$'
   AND (NEW.regras->>'antecedenciaCancelamentoMinutos')::numeric BETWEEN 0 AND 5256000
   AND length(trim(NEW.regras->>'clausulaPreco')) BETWEEN 1 AND 2000
   AND length(trim(NEW.regras->>'clausulaCancelamento')) BETWEEN 1 AND 2000
   AND NEW.regras->>'vigenteDesde' ~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
   AND isfinite((NEW.regras->>'vigenteDesde')::timestamptz), false) THEN RAISE EXCEPTION 'Regras de hora incompletas ou incompatíveis.'; END IF;
  IF length(trim(NEW.motivo))<5 THEN RAISE EXCEPTION 'Justifique a transcrição.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validar_condicoes_horas BEFORE INSERT OR UPDATE OR DELETE ON "CondicoesHorasMatricula"
FOR EACH ROW EXECUTE FUNCTION validar_condicoes_horas();
