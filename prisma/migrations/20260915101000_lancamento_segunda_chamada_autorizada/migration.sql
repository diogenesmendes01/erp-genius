-- Q151: a exceção de vínculo encerrado pertence exclusivamente à nota que
-- reproduz uma realização de segunda chamada já preservada no banco.
CREATE FUNCTION nota_segunda_chamada_autorizada(
  registro_id TEXT, realizacao_id TEXT, realizada_em TIMESTAMP, realizada_por_id TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE AS $$
DECLARE fonte record; situacao TEXT;
BEGIN
 IF registro_id IS NULL OR realizacao_id IS NULL OR realizada_em IS NULL
    OR realizada_por_id IS NULL OR NOT isfinite(realizada_em) THEN
  RETURN false;
 END IF;
 SELECT sc."realizadaEm",sc."professorId",rs.status,p."matriculaId",p."alocacaoId",p."regraId",p."codigoAvaliacao"
   INTO fonte
   FROM "RealizacaoSegundaChamada" sc
   JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId"
   JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId"
   JOIN "Matricula" m ON m.id=p."matriculaId"
   JOIN "RegistroAvaliacaoMatricula" r ON r.id=registro_id
   WHERE sc.id=realizacao_id
     AND rs.status='CONSUMIDA_REALIZACAO'
     AND (r."matriculaId",r."alocacaoId",r."regraId",r."codigoAvaliacao")
         IS NOT DISTINCT FROM (p."matriculaId",p."alocacaoId",p."regraId",p."codigoAvaliacao")
     AND sc."realizadaEm" IS NOT DISTINCT FROM realizada_em
     AND sc."professorId" IS NOT DISTINCT FROM realizada_por_id
   FOR KEY SHARE OF sc,rs,p,m,r;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT situacao_matricula_no_instante(fonte."matriculaId",fonte."realizadaEm") INTO situacao;
 IF situacao='ATIVA' THEN RETURN true; END IF;
 RETURN situacao IN ('PAUSADA','ENCERRADA')
   AND autorizacao_especial_segunda_chamada_valida(
     fonte."alocacaoId",fonte."codigoAvaliacao",fonte."realizadaEm"
   );
END $$;

CREATE OR REPLACE FUNCTION preservar_lancamento_avaliacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "RegistroAvaliacaoMatricula"%ROWTYPE; v "VersaoLancamentoAvaliacao"%ROWTYPE; a "AlocacaoTurma"%ROWTYPE; segunda_autorizada BOOLEAN;
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
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT * INTO r FROM "RegistroAvaliacaoMatricula" WHERE id = NEW."registroId";
  PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id = r.id FOR UPDATE;
  IF NEW.versao <> (SELECT COALESCE(MAX(versao),0)+1 FROM "VersaoLancamentoAvaliacao" WHERE "registroId" = r.id) THEN RAISE EXCEPTION 'Versão do lançamento desatualizada'; END IF;
  IF EXISTS (SELECT 1 FROM "VersaoLancamentoAvaliacao" l JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId" = l.id AND d.aprovada WHERE l."registroId" = r.id) THEN RAISE EXCEPTION 'Nota oficial exige correção independente'; END IF;
  PERFORM id FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND 'PROFESSOR'::"Papel" = ANY(papeis) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento exige professor ativo'; END IF;
  PERFORM conferir_autoria_lancamento(r.id, NEW."autorId", COALESCE(NEW."realizadaPorId", NEW."autorId"), NEW."realizadaEm", NEW."motivoRegularizacao", NEW."evidenciasRegularizacao");
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id = r."alocacaoId";
  segunda_autorizada:=nota_segunda_chamada_autorizada(r.id,NEW."segundaChamadaRealizacaoId",NEW."realizadaEm",NEW."realizadaPorId");
  IF NEW."realizadaEm" > (clock_timestamp() AT TIME ZONE 'UTC') OR NEW."realizadaEm" < a."criadoEm"
     OR (((a."encerradaEm" IS NOT NULL AND NEW."realizadaEm" >= a."encerradaEm") OR (NOT a.ativa AND a."encerradaEm" IS NULL)) AND NOT segunda_autorizada) THEN
   RAISE EXCEPTION 'Data fora do vínculo histórico da avaliação';
  END IF;
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
