-- CreateTable
CREATE TABLE "OcorrenciaParticular" (
    "id" TEXT NOT NULL,
    "encontroId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "comunicadoEm" TIMESTAMP(3),
    "evidencia" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcorrenciaParticular_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcorrenciaParticular_matriculaId_idx" ON "OcorrenciaParticular"("matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "OcorrenciaParticular_encontroId_versao_key" ON "OcorrenciaParticular"("encontroId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "OcorrenciaParticular_autorId_chaveIdempotencia_key" ON "OcorrenciaParticular"("autorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "OcorrenciaParticular" ADD CONSTRAINT "OcorrenciaParticular_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OcorrenciaParticular" ADD CONSTRAINT "OcorrenciaParticular_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OcorrenciaParticular" ADD CONSTRAINT "OcorrenciaParticular_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "OcorrenciaParticular" ADD CONSTRAINT "ocorrencia_particular_dados" CHECK (
  versao > 0 AND fim > inicio AND length(trim(evidencia)) >= 5
  AND tipo IN ('REALIZADA', 'FALTA_ALUNO', 'CANCELAMENTO_ALUNO', 'CANCELAMENTO_ESCOLA')
  AND ((tipo IN ('REALIZADA', 'FALTA_ALUNO') AND "comunicadoEm" IS NULL)
    OR (tipo IN ('CANCELAMENTO_ALUNO', 'CANCELAMENTO_ESCOLA') AND "comunicadoEm" IS NOT NULL))
);
CREATE FUNCTION conferir_ocorrencia_particular() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "EncontroAgenda"%ROWTYPE; u "Usuario"%ROWTYPE; anterior integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Ocorrências particulares devem ser preservadas.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO e FROM "EncontroAgenda" WHERE id = NEW."encontroId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF e."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR e."turmaId" IS NOT NULL
    OR e."professorId" IS DISTINCT FROM NEW."autorId" OR u.ativo IS DISTINCT FROM true
    OR NOT ('PROFESSOR' = ANY(u.papeis)) THEN RAISE EXCEPTION 'Sem atribuição docente para esta particular.'; END IF;
  IF e.inicio <> NEW.inicio OR e.fim <> NEW.fim THEN RAISE EXCEPTION 'A agenda mudou.'; END IF;
  IF NEW."criadoEm" > clock_timestamp() OR NEW."comunicadoEm" > NEW."criadoEm" THEN RAISE EXCEPTION 'Data de ocorrência inválida.'; END IF;
  IF NEW.tipo IN ('REALIZADA', 'FALTA_ALUNO') THEN
    IF e.status NOT IN ('PREVISTO', 'MINISTRADO') OR NEW.fim > NEW."criadoEm" THEN RAISE EXCEPTION 'Aguarde o término do encontro previsto.'; END IF;
  ELSE
    IF e.status <> 'CANCELADO' OR NOT EXISTS (
      SELECT 1 FROM "DecisaoCancelamentoParticular" d JOIN "PropostaCancelamentoParticular" p ON p.id = d."propostaId"
      WHERE p."encontroId" = e.id AND d.aprovada
    ) THEN RAISE EXCEPTION 'Cancelamento precisa de aprovação pedagógica.'; END IF;
  END IF;
  SELECT COALESCE(MAX(versao), 0) INTO anterior FROM "OcorrenciaParticular" WHERE "encontroId" = e.id;
  IF NEW.versao <> anterior + 1 THEN RAISE EXCEPTION 'Versão da ocorrência mudou.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_ocorrencia_particular BEFORE INSERT OR UPDATE OR DELETE ON "OcorrenciaParticular"
FOR EACH ROW EXECUTE FUNCTION conferir_ocorrencia_particular();
