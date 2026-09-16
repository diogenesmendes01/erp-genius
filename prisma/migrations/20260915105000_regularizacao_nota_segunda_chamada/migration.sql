-- Q152: a regularização não transfere a realização; só documenta a nota da
-- segunda chamada persistida, com o realizador e o instante originais.
CREATE FUNCTION autoria_segunda_chamada_valida(
  registro_id TEXT, realizacao_id TEXT, autor_id TEXT, realizada_por_id TEXT, realizada_em TIMESTAMP, motivo TEXT, evidencias TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE AS $$
DECLARE proposta_id TEXT; designado_atual TEXT; designado_historico TEXT;
BEGIN
 IF autor_id IS NULL OR realizada_por_id IS NULL
    OR NOT nota_segunda_chamada_autorizada(registro_id,realizacao_id,realizada_em,realizada_por_id) THEN RETURN false; END IF;
 SELECT p.id INTO proposta_id FROM "RealizacaoSegundaChamada" sc JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId" JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId" WHERE sc.id=realizacao_id FOR KEY SHARE OF sc,rs,p;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT d."professorId" INTO designado_historico FROM "DesignacaoSegundaChamada" d WHERE d."propostaId"=proposta_id AND d."criadaEm"<=realizada_em AND d.inicio<=realizada_em AND (d.fim IS NULL OR d.fim>realizada_em) ORDER BY d.versao DESC LIMIT 1 FOR SHARE;
 IF autor_id=realizada_por_id THEN
  SELECT d."professorId" INTO designado_atual FROM "DesignacaoSegundaChamada" d WHERE d."propostaId"=proposta_id AND d."criadaEm"<=(clock_timestamp() AT TIME ZONE 'UTC') AND d.inicio<=(clock_timestamp() AT TIME ZONE 'UTC') AND (d.fim IS NULL OR d.fim>(clock_timestamp() AT TIME ZONE 'UTC')) ORDER BY d.versao DESC LIMIT 1 FOR SHARE;
  RETURN designado_atual=autor_id AND designado_historico=autor_id;
 END IF;
 IF COALESCE(length(btrim(motivo)),0)<5 OR COALESCE(length(btrim(evidencias)),0)<5 OR length(motivo)>2000 OR length(evidencias)>4000 OR designado_historico IS DISTINCT FROM realizada_por_id THEN RETURN false; END IF;
 SELECT d."professorId" INTO designado_atual FROM "DesignacaoAvaliacao" d WHERE d."registroId"=registro_id ORDER BY d.versao DESC LIMIT 1 FOR SHARE;
 RETURN designado_atual=autor_id;
END $$;

CREATE OR REPLACE FUNCTION preservar_lancamento_avaliacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "RegistroAvaliacaoMatricula"%ROWTYPE; v "VersaoLancamentoAvaliacao"%ROWTYPE; a "AlocacaoTurma"%ROWTYPE; segunda_autorizada BOOLEAN; autoria_segunda BOOLEAN;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Registro, lançamento e decisão de avaliação são imutáveis'; END IF;
 IF TG_TABLE_NAME = 'RegistroAvaliacaoMatricula' THEN
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id=NEW."alocacaoId";
  IF a."matriculaId" IS DISTINCT FROM NEW."matriculaId" OR a."turmaId"<>NEW."turmaId" THEN RAISE EXCEPTION 'Avaliação exige alocação da matrícula e turma corretas'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Turma" WHERE id=NEW."turmaId" AND "regraAvaliacaoId"=NEW."regraId") THEN RAISE EXCEPTION 'Avaliação exige regra vinculada à turma'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "VersaoRegraAvaliacao" regra,jsonb_array_elements(regra.conteudo->'avaliacoes') av WHERE regra.id=NEW."regraId" AND av->>'codigo'=NEW."codigoAvaliacao") THEN RAISE EXCEPTION 'Código de avaliação fora da regra'; END IF;
  RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='VersaoLancamentoAvaliacao' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
  SELECT * INTO r FROM "RegistroAvaliacaoMatricula" WHERE id=NEW."registroId"; PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id=r.id FOR UPDATE;
  IF NEW.versao<>(SELECT COALESCE(MAX(versao),0)+1 FROM "VersaoLancamentoAvaliacao" WHERE "registroId"=r.id) THEN RAISE EXCEPTION 'Versão do lançamento desatualizada'; END IF;
  IF EXISTS(SELECT 1 FROM "VersaoLancamentoAvaliacao" l JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id AND d.aprovada WHERE l."registroId"=r.id) THEN RAISE EXCEPTION 'Nota oficial exige correção independente'; END IF;
  PERFORM id FROM "Usuario" WHERE id=NEW."autorId" AND ativo AND 'PROFESSOR'::"Papel"=ANY(papeis) FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento exige professor ativo'; END IF;
  autoria_segunda:=NEW."segundaChamadaRealizacaoId" IS NOT NULL AND autoria_segunda_chamada_valida(r.id,NEW."segundaChamadaRealizacaoId",NEW."autorId",NEW."realizadaPorId",NEW."realizadaEm",NEW."motivoRegularizacao",NEW."evidenciasRegularizacao");
  IF autoria_segunda IS DISTINCT FROM true THEN PERFORM conferir_autoria_lancamento(r.id,NEW."autorId",COALESCE(NEW."realizadaPorId",NEW."autorId"),NEW."realizadaEm",NEW."motivoRegularizacao",NEW."evidenciasRegularizacao"); END IF;
  SELECT * INTO a FROM "AlocacaoTurma" WHERE id=r."alocacaoId"; segunda_autorizada:=nota_segunda_chamada_autorizada(r.id,NEW."segundaChamadaRealizacaoId",NEW."realizadaEm",NEW."realizadaPorId");
  IF NEW."realizadaEm">(clock_timestamp() AT TIME ZONE 'UTC') OR NEW."realizadaEm"<a."criadoEm" OR (((a."encerradaEm" IS NOT NULL AND NEW."realizadaEm">=a."encerradaEm") OR (NOT a.ativa AND a."encerradaEm" IS NULL)) AND NOT segunda_autorizada) THEN RAISE EXCEPTION 'Data fora do vínculo histórico da avaliação'; END IF;
  IF NEW.submetida AND EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.notas) n WHERE n->'nota'='null'::jsonb) THEN RAISE EXCEPTION 'Submissão exige notas preenchidas'; END IF;
 ELSE
  SELECT * INTO v FROM "VersaoLancamentoAvaliacao" WHERE id=NEW."lancamentoId"; PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id=v."registroId" FOR UPDATE;
  IF v."autorId"=NEW."decisorId" OR v."realizadaPorId"=NEW."decisorId" THEN RAISE EXCEPTION 'Oficialização exige outra pessoa'; END IF;
  PERFORM id FROM "Usuario" WHERE id=NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Oficialização exige gestão ativa'; END IF;
  IF NOT v.submetida THEN RAISE EXCEPTION 'Rascunho não pode receber decisão'; END IF;
  IF NEW.aprovada THEN IF v.versao<>(SELECT MAX(versao) FROM "VersaoLancamentoAvaliacao" WHERE "registroId"=v."registroId") THEN RAISE EXCEPTION 'Existe lançamento mais recente'; END IF; IF EXISTS(SELECT 1 FROM "VersaoLancamentoAvaliacao" l JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id AND d.aprovada WHERE l."registroId"=v."registroId") THEN RAISE EXCEPTION 'Já existe resultado oficial'; END IF; END IF;
 END IF;
 RETURN NEW;
END;
$$;
