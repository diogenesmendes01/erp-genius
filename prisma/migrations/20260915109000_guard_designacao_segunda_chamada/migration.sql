-- Q152: designações são fatos append-only e só podem nascer no contexto exato
-- da avaliação pendente que a proposta identificou.
CREATE FUNCTION preservar_designacao_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaSegundaChamada"%ROWTYPE; alocacao "AlocacaoTurma"%ROWTYPE; agora TIMESTAMP;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Designação de segunda chamada é imutável'; END IF;
 SELECT * INTO proposta FROM "PropostaSegundaChamada" WHERE id=NEW."propostaId" FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Designação exige proposta de segunda chamada existente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO alocacao FROM "AlocacaoTurma" WHERE id=proposta."alocacaoId" FOR SHARE;
 IF NOT FOUND OR alocacao."matriculaId" IS DISTINCT FROM proposta."matriculaId" OR alocacao."turmaId" IS DISTINCT FROM proposta."turmaId" THEN
  RAISE EXCEPTION 'Designação exige alocação, matrícula e turma exatas da proposta';
 END IF;
 PERFORM id FROM "Turma" WHERE id=proposta."turmaId" AND "regraAvaliacaoId"=proposta."regraId" FOR SHARE;
 IF NOT FOUND OR NOT EXISTS (
   SELECT 1 FROM "VersaoRegraAvaliacao" regra,jsonb_array_elements(regra.conteudo->'avaliacoes') avaliacao
   WHERE regra.id=proposta."regraId" AND avaliacao->>'codigo'=proposta."codigoAvaliacao"
 ) THEN RAISE EXCEPTION 'Designação exige avaliação presente na regra vigente'; END IF;
 IF EXISTS (
   SELECT 1 FROM "RegistroAvaliacaoMatricula" registro
   JOIN "VersaoLancamentoAvaliacao" lancamento ON lancamento."registroId"=registro.id
   JOIN "DecisaoLancamentoAvaliacao" decisao ON decisao."lancamentoId"=lancamento.id AND decisao.aprovada
   WHERE (registro."matriculaId",registro."alocacaoId",registro."turmaId",registro."regraId",registro."codigoAvaliacao")
       IS NOT DISTINCT FROM (proposta."matriculaId",proposta."alocacaoId",proposta."turmaId",proposta."regraId",proposta."codigoAvaliacao")
 ) THEN RAISE EXCEPTION 'Designação exige avaliação pendente'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."gestorId" AND ativo
   AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Designação exige gestão ativa'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."professorId" AND ativo
   AND 'PROFESSOR'::"Papel"=ANY(papeis) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Designação exige professor ativo'; END IF;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF NEW.versao<>(SELECT COALESCE(MAX(versao),0)+1 FROM "DesignacaoSegundaChamada" WHERE "propostaId"=proposta.id) THEN
  RAISE EXCEPTION 'Versão de designação desatualizada';
 END IF;
 IF NEW.inicio IS NULL OR NOT isfinite(NEW.inicio) OR NEW.inicio>agora
   OR (NEW.fim IS NOT NULL AND (NOT isfinite(NEW.fim) OR NEW.fim<=NEW.inicio)) THEN
  RAISE EXCEPTION 'Vigência da designação inválida';
 END IF;
 IF length(btrim(NEW.motivo))<5 OR length(NEW.motivo)>2000
   OR length(NEW."chaveIdempotencia")<8 OR length(NEW."chaveIdempotencia")>100
   OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Conteúdo da designação inválido'; END IF;
 NEW."criadaEm":=agora;
 RETURN NEW;
END $$;

CREATE TRIGGER preservar_designacao_segunda_chamada
BEFORE INSERT OR UPDATE OR DELETE ON "DesignacaoSegundaChamada"
FOR EACH ROW EXECUTE FUNCTION preservar_designacao_segunda_chamada();
