-- CreateTable
CREATE TABLE "RegistroAvaliacaoMatricula" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "alocacaoId" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "codigoAvaliacao" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAvaliacaoMatricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersaoLancamentoAvaliacao" (
    "id" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "autorId" TEXT NOT NULL,
    "realizadaEm" TIMESTAMP(3) NOT NULL,
    "notas" JSONB NOT NULL,
    "submetida" BOOLEAN NOT NULL,
    "conteudoHash" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersaoLancamentoAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoLancamentoAvaliacao" (
    "id" TEXT NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoLancamentoAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAvaliacaoMatricula_matriculaId_turmaId_codigoAvalia_key" ON "RegistroAvaliacaoMatricula"("matriculaId", "turmaId", "codigoAvaliacao");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoLancamentoAvaliacao_registroId_versao_key" ON "VersaoLancamentoAvaliacao"("registroId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoLancamentoAvaliacao_autorId_chaveIdempotencia_key" ON "VersaoLancamentoAvaliacao"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoLancamentoAvaliacao_lancamentoId_key" ON "DecisaoLancamentoAvaliacao"("lancamentoId");

-- AddForeignKey
ALTER TABLE "RegistroAvaliacaoMatricula" ADD CONSTRAINT "RegistroAvaliacaoMatricula_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RegistroAvaliacaoMatricula" ADD CONSTRAINT "RegistroAvaliacaoMatricula_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RegistroAvaliacaoMatricula" ADD CONSTRAINT "RegistroAvaliacaoMatricula_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "AlocacaoTurma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RegistroAvaliacaoMatricula" ADD CONSTRAINT "RegistroAvaliacaoMatricula_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "VersaoRegraAvaliacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VersaoLancamentoAvaliacao" ADD CONSTRAINT "VersaoLancamentoAvaliacao_registroId_fkey" FOREIGN KEY ("registroId") REFERENCES "RegistroAvaliacaoMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VersaoLancamentoAvaliacao" ADD CONSTRAINT "VersaoLancamentoAvaliacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoLancamentoAvaliacao" ADD CONSTRAINT "DecisaoLancamentoAvaliacao_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "VersaoLancamentoAvaliacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoLancamentoAvaliacao" ADD CONSTRAINT "DecisaoLancamentoAvaliacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "VersaoLancamentoAvaliacao" ADD CONSTRAINT "lancamento_versao_positiva" CHECK (versao > 0);
CREATE FUNCTION preservar_lancamento_avaliacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "RegistroAvaliacaoMatricula"%ROWTYPE; v "VersaoLancamentoAvaliacao"%ROWTYPE; a "AlocacaoTurma"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Registro, lançamento e decisão de avaliação são imutáveis'; END IF;
 IF TG_TABLE_NAME = 'RegistroAvaliacaoMatricula' THEN
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id = NEW."alocacaoId";
  IF a."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR a."turmaId" <> NEW."turmaId" THEN RAISE EXCEPTION 'Avaliação exige alocação da matrícula e turma corretas'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Turma" WHERE id = NEW."turmaId" AND "regraAvaliacaoId" = NEW."regraId") THEN RAISE EXCEPTION 'Avaliação exige regra vinculada à turma'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "VersaoRegraAvaliacao" regra, jsonb_array_elements(regra.conteudo->'avaliacoes') av WHERE regra.id = NEW."regraId" AND av->>'codigo' = NEW."codigoAvaliacao") THEN RAISE EXCEPTION 'Código de avaliação fora da regra'; END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME = 'VersaoLancamentoAvaliacao' THEN
  SELECT * INTO r FROM "RegistroAvaliacaoMatricula" WHERE id = NEW."registroId";
  PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id = r.id FOR UPDATE;
  IF NEW.versao <> (SELECT COALESCE(MAX(versao),0)+1 FROM "VersaoLancamentoAvaliacao" WHERE "registroId" = r.id) THEN RAISE EXCEPTION 'Versão do lançamento desatualizada'; END IF;
  IF EXISTS (SELECT 1 FROM "VersaoLancamentoAvaliacao" l JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId" = l.id AND d.aprovada WHERE l."registroId" = r.id) THEN RAISE EXCEPTION 'Nota oficial exige correção independente'; END IF;
  PERFORM id FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND 'PROFESSOR'::"Papel" = ANY(papeis) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento exige professor ativo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Turma" t JOIN "VinculoDocente" vd ON vd."turmaId" = t.id AND vd."professorId" = NEW."autorId"
   WHERE t.id = r."turmaId" AND t."professorId" = NEW."autorId" AND t.status <> 'CONCLUIDA' AND vd.fim IS NULL AND vd.inicio <= NEW."realizadaEm") THEN RAISE EXCEPTION 'Professor sem atribuição para a avaliação'; END IF;
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id = r."alocacaoId";
  IF NEW."realizadaEm" > clock_timestamp() OR NEW."realizadaEm" < a."criadoEm" OR (a."encerradaEm" IS NOT NULL AND NEW."realizadaEm" >= a."encerradaEm") OR (NOT a.ativa AND a."encerradaEm" IS NULL) THEN RAISE EXCEPTION 'Data fora do vínculo histórico da avaliação'; END IF;
  IF NEW.submetida AND EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.notas) n WHERE n->'nota' = 'null'::jsonb) THEN RAISE EXCEPTION 'Submissão exige notas preenchidas'; END IF;
 ELSE
  SELECT * INTO v FROM "VersaoLancamentoAvaliacao" WHERE id = NEW."lancamentoId";
  PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id = v."registroId" FOR UPDATE;
  IF v."autorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Oficialização exige outra pessoa'; END IF;
  PERFORM id FROM "Usuario" WHERE id = NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oficialização exige gestão ativa'; END IF;
  IF NOT v.submetida THEN RAISE EXCEPTION 'Rascunho não pode receber decisão'; END IF;
  IF NEW.aprovada THEN
   IF v.versao <> (SELECT MAX(versao) FROM "VersaoLancamentoAvaliacao" WHERE "registroId" = v."registroId") THEN RAISE EXCEPTION 'Existe lançamento mais recente'; END IF;
   IF EXISTS (SELECT 1 FROM "VersaoLancamentoAvaliacao" l JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId" = l.id AND d.aprovada WHERE l."registroId" = v."registroId") THEN RAISE EXCEPTION 'Já existe resultado oficial'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_registro_avaliacao BEFORE INSERT OR UPDATE OR DELETE ON "RegistroAvaliacaoMatricula" FOR EACH ROW EXECUTE FUNCTION preservar_lancamento_avaliacao();
CREATE TRIGGER preservar_versao_lancamento BEFORE INSERT OR UPDATE OR DELETE ON "VersaoLancamentoAvaliacao" FOR EACH ROW EXECUTE FUNCTION preservar_lancamento_avaliacao();
CREATE TRIGGER preservar_decisao_lancamento BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoLancamentoAvaliacao" FOR EACH ROW EXECUTE FUNCTION preservar_lancamento_avaliacao();

CREATE OR REPLACE FUNCTION conferir_turma_antes_avaliacao(turma_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE t "Turma"%ROWTYPE;
BEGIN
 SELECT * INTO t FROM "Turma" WHERE id = turma_id;
 IF EXISTS (SELECT 1 FROM "RegistroAvaliacaoMatricula" WHERE "turmaId" = turma_id) THEN RAISE EXCEPTION 'Turma possui registros de avaliação; preserve a regra'; END IF;
 IF t.status NOT IN ('PLANEJADA', 'ABERTA') OR
  EXISTS (SELECT 1 FROM "AulaDiario" WHERE "turmaId" = turma_id) OR
  EXISTS (SELECT 1 FROM "Evento" WHERE "agregadoTipo" = 'Turma' AND "agregadoId" = turma_id AND tipo = 'TurmaEmAndamento') OR
  EXISTS (SELECT 1 FROM "EncontroAgenda" WHERE "turmaId" = turma_id AND (status = 'MINISTRADO' OR (status = 'PREVISTO' AND inicio <= clock_timestamp()))) THEN
  RAISE EXCEPTION 'Turma já iniciou; regra de avaliação deve ser preservada';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM "EncontroAgenda" WHERE "turmaId" = turma_id AND status IN ('PREVISTO','MINISTRADO')) AND
  (t."dataInicio" IS NULL OR t."dataInicio" <= clock_timestamp()) THEN
  RAISE EXCEPTION 'Data futura ou agenda válida precisa ser conferida';
 END IF;
END;
$$;
