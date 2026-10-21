ALTER TABLE "VersaoLancamentoAvaliacao"
 ADD COLUMN "realizadaPorId" TEXT,
 ADD COLUMN "motivoRegularizacao" TEXT,
 ADD COLUMN "evidenciasRegularizacao" TEXT;
ALTER TABLE "VersaoLancamentoAvaliacao" ADD CONSTRAINT "VersaoLancamentoAvaliacao_realizadaPorId_fkey" FOREIGN KEY ("realizadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION conferir_autoria_lancamento(registro_id TEXT, registrador_id TEXT, realizador_id TEXT, realizada_em TIMESTAMP, motivo TEXT, evidencias TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r "RegistroAvaliacaoMatricula"%ROWTYPE; designado_id TEXT; historico_id TEXT;
BEGIN
 SELECT * INTO r FROM "RegistroAvaliacaoMatricula" WHERE id = registro_id;
 SELECT "professorId" INTO designado_id FROM "DesignacaoAvaliacao" WHERE "registroId" = registro_id ORDER BY versao DESC LIMIT 1;
 IF designado_id IS DISTINCT FROM registrador_id AND NOT EXISTS (
  SELECT 1 FROM "Turma" t JOIN "VinculoDocente" vd ON vd."turmaId" = t.id AND vd."professorId" = registrador_id
  WHERE t.id = r."turmaId" AND t."professorId" = registrador_id AND t.status <> 'CONCLUIDA' AND vd.fim IS NULL AND vd.inicio <= clock_timestamp()
 ) THEN RAISE EXCEPTION 'Professor sem atribuição para a avaliação'; END IF;
 IF realizador_id <> registrador_id THEN
  IF designado_id IS DISTINCT FROM registrador_id OR COALESCE(length(btrim(motivo)),0) < 5 OR COALESCE(length(btrim(evidencias)),0) < 5 OR length(motivo) > 2000 OR length(evidencias) > 4000 THEN
   RAISE EXCEPTION 'Regularização exige designação, motivo e evidências';
  END IF;
 ELSIF motivo IS NOT NULL OR evidencias IS NOT NULL THEN RAISE EXCEPTION 'Regularização exige realizador distinto'; END IF;
 SELECT "professorId" INTO historico_id FROM "DesignacaoAvaliacao" WHERE "registroId" = registro_id AND "criadaEm" <= realizada_em ORDER BY versao DESC LIMIT 1;
 IF historico_id IS DISTINCT FROM realizador_id AND NOT EXISTS (
  SELECT 1 FROM "VinculoDocente" vd WHERE vd."turmaId" = r."turmaId" AND vd."professorId" = realizador_id AND vd.inicio <= realizada_em AND (vd.fim IS NULL OR vd.fim > realizada_em)
 ) THEN RAISE EXCEPTION 'Realizador sem atribuição histórica para a avaliação'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION preservar_lancamento_avaliacao() RETURNS trigger LANGUAGE plpgsql AS $$
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
  PERFORM conferir_autoria_lancamento(r.id, NEW."autorId", COALESCE(NEW."realizadaPorId", NEW."autorId"), NEW."realizadaEm", NEW."motivoRegularizacao", NEW."evidenciasRegularizacao");
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id = r."alocacaoId";
  IF NEW."realizadaEm" > clock_timestamp() OR NEW."realizadaEm" < a."criadoEm" OR (a."encerradaEm" IS NOT NULL AND NEW."realizadaEm" >= a."encerradaEm") OR (NOT a.ativa AND a."encerradaEm" IS NULL) THEN RAISE EXCEPTION 'Data fora do vínculo histórico da avaliação'; END IF;
  IF NEW.submetida AND EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.notas) n WHERE n->'nota' = 'null'::jsonb) THEN RAISE EXCEPTION 'Submissão exige notas preenchidas'; END IF;
 ELSE
  SELECT * INTO v FROM "VersaoLancamentoAvaliacao" WHERE id = NEW."lancamentoId";
  PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id = v."registroId" FOR UPDATE;
  IF v."autorId" = NEW."decisorId" OR v."realizadaPorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Oficialização exige outra pessoa'; END IF;
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
