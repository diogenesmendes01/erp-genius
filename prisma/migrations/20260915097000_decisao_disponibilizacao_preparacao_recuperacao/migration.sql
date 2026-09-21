CREATE FUNCTION autorizacao_preparacao_recuperacao_valida(plano "PropostaPlanoRecuperacao", instante TIMESTAMP) RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE AS $$
DECLARE a "AutorizacaoEspecialPreparacaoRecuperacao"%ROWTYPE;
BEGIN
 IF plano."autorizacaoPreparacaoId" IS NULL OR instante IS NULL OR NOT isfinite(instante) THEN RETURN false; END IF;
 SELECT * INTO a FROM "AutorizacaoEspecialPreparacaoRecuperacao" WHERE id=plano."autorizacaoPreparacaoId" FOR SHARE;
 IF NOT FOUND OR a."alocacaoId" IS DISTINCT FROM plano."alocacaoId" OR NOT isfinite(a."prazoAte") OR a."criadaEm">instante OR a."prazoAte"<instante THEN RETURN false; END IF;
 PERFORM id FROM "Usuario" WHERE id=a."autorizadorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM "Matricula" WHERE id=plano."matriculaId" AND status IN ('PAUSADA','ENCERRADA')) OR NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" x JOIN "Turma" t ON t.id=x."turmaId" WHERE x.id=plano."alocacaoId" AND x."matriculaId"=plano."matriculaId" AND t."nivelId"=plano."nivelId" AND t."regraAvaliacaoId"=plano."regraId") THEN RETURN false; END IF;
 RETURN a.snapshot IS NOT DISTINCT FROM jsonb_build_object('matriculaId',plano."matriculaId",'alocacaoId',plano."alocacaoId",'turmaId',(SELECT "turmaId" FROM "AlocacaoTurma" WHERE id=plano."alocacaoId"),'nivelId',plano."nivelId",'regraId',plano."regraId",'statusMatricula',(SELECT status::text FROM "Matricula" WHERE id=plano."matriculaId"));
END $$;
CREATE OR REPLACE FUNCTION preservar_decisao_plano_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão de recuperação é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0)); SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id=NEW."propostaId" FOR SHARE; PERFORM id FROM "Matricula" WHERE id=p."matriculaId" FOR UPDATE;
 IF p."preparadorId"=NEW."decisorId" THEN RAISE EXCEPTION 'Decisão exige outra pessoa'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige gestão ativa'; END IF;
 IF NEW.aprovada THEN
  IF p.versao<>(SELECT MAX(versao) FROM "PropostaPlanoRecuperacao" WHERE "matriculaId"=p."matriculaId" AND "nivelId"=p."nivelId") THEN RAISE EXCEPTION 'Existe proposta de recuperação mais recente'; END IF;
  IF p."autorizacaoPreparacaoId" IS NULL THEN IF NOT EXISTS(SELECT 1 FROM "Matricula" m JOIN "AlocacaoTurma" a ON a."matriculaId"=m.id JOIN "Turma" t ON t.id=a."turmaId" WHERE m.id=p."matriculaId" AND m.status='ATIVA' AND a.id=p."alocacaoId" AND a.ativa AND t."nivelId"=p."nivelId" AND t."regraAvaliacaoId"=p."regraId") THEN RAISE EXCEPTION 'Vínculo do plano mudou'; END IF;
  ELSIF NOT autorizacao_preparacao_recuperacao_valida(p,clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Autorização especial de preparação inválida'; END IF;
 END IF;
 IF COALESCE(length(btrim(NEW.motivo)),0)<5 THEN RAISE EXCEPTION 'Justifique a decisão'; END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION preservar_disponibilizacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE; aprovada_em TIMESTAMP; prazo INTEGER;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Disponibilização de recuperação é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0)); SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id=NEW."propostaId" FOR SHARE; PERFORM id FROM "Matricula" WHERE id=p."matriculaId" FOR UPDATE;
 PERFORM id FROM "Usuario" WHERE id=NEW."autorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Disponibilização exige gestão ativa'; END IF;
 SELECT "criadaEm" INTO aprovada_em FROM "DecisaoPlanoRecuperacao" WHERE "propostaId"=p.id AND aprovada;
 IF aprovada_em IS NULL OR NEW."disponibilizadaEm"<aprovada_em OR NEW."disponibilizadaEm">clock_timestamp() AT TIME ZONE 'UTC' THEN RAISE EXCEPTION 'Disponibilização exige aprovação e data válida'; END IF;
 IF p."autorizacaoPreparacaoId" IS NULL THEN IF NOT EXISTS(SELECT 1 FROM "Matricula" m JOIN "AlocacaoTurma" a ON a."matriculaId"=m.id WHERE m.id=p."matriculaId" AND m.status='ATIVA' AND a.id=p."alocacaoId" AND a.ativa) THEN RAISE EXCEPTION 'Disponibilização exige matrícula ativa'; END IF;
 ELSIF NOT autorizacao_preparacao_recuperacao_valida(p,clock_timestamp() AT TIME ZONE 'UTC') OR NOT autorizacao_preparacao_recuperacao_valida(p,NEW."disponibilizadaEm") THEN RAISE EXCEPTION 'Autorização especial de preparação inválida'; END IF;
 SELECT (conteudo->'recuperacao'->>'prazoRealizacaoMinutos')::integer INTO prazo FROM "VersaoRegraAvaliacao" WHERE id=p."regraId";
 IF prazo IS NULL OR NEW."prazoMinutos"<>prazo OR NEW."prazoAte"<>NEW."disponibilizadaEm"+prazo*interval '1 minute' THEN RAISE EXCEPTION 'Prazo incompatível com a regra aprovada'; END IF;
 IF COALESCE(length(btrim(NEW.condicoes)),0)<5 OR length(NEW.condicoes)>4000 OR COALESCE(length(btrim(NEW."evidenciaComunicacao")),0)<5 OR length(NEW."evidenciaComunicacao")>4000 THEN RAISE EXCEPTION 'Registre condições e evidência de comunicação ao aluno'; END IF; RETURN NEW;
END $$;
