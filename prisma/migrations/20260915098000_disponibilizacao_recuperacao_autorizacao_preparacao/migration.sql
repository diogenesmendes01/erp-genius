-- Q151: uma autorização de preparação pode liberar a disponibilização de um
-- plano aprovado antes da pausa/encerramento, sem alterar a proposta ou decisão.
ALTER TABLE "DisponibilizacaoPlanoRecuperacao" ADD COLUMN "autorizacaoPreparacaoId" TEXT;
ALTER TABLE "DisponibilizacaoPlanoRecuperacao"
  ADD CONSTRAINT "DisponibilizacaoPlanoRecuperacao_autorizacaoPreparacaoId_fkey"
  FOREIGN KEY ("autorizacaoPreparacaoId") REFERENCES "AutorizacaoEspecialPreparacaoRecuperacao"(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION autorizacao_preparacao_recuperacao_valida_para(
  plano "PropostaPlanoRecuperacao", autorizacao_id TEXT, instante TIMESTAMP
) RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE AS $$
DECLARE autorizacao "AutorizacaoEspecialPreparacaoRecuperacao"%ROWTYPE;
BEGIN
 IF autorizacao_id IS NULL OR instante IS NULL OR NOT isfinite(instante) THEN RETURN false; END IF;
 SELECT * INTO autorizacao FROM "AutorizacaoEspecialPreparacaoRecuperacao" WHERE id=autorizacao_id FOR SHARE;
 IF NOT FOUND OR autorizacao."alocacaoId" IS DISTINCT FROM plano."alocacaoId" OR NOT isfinite(autorizacao."prazoAte")
    OR autorizacao."criadaEm">instante OR autorizacao."prazoAte"<instante THEN RETURN false; END IF;
 PERFORM id FROM "Usuario" WHERE id=autorizacao."autorizadorId" AND ativo
   AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND
    OR NOT EXISTS(SELECT 1 FROM "Matricula" WHERE id=plano."matriculaId" AND status IN ('PAUSADA','ENCERRADA'))
    OR NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId"
      WHERE a.id=plano."alocacaoId" AND a."matriculaId"=plano."matriculaId"
        AND t."nivelId"=plano."nivelId" AND t."regraAvaliacaoId"=plano."regraId") THEN RETURN false; END IF;
 RETURN autorizacao.snapshot IS NOT DISTINCT FROM jsonb_build_object(
   'matriculaId',plano."matriculaId",'alocacaoId',plano."alocacaoId",
   'turmaId',(SELECT "turmaId" FROM "AlocacaoTurma" WHERE id=plano."alocacaoId"),
   'nivelId',plano."nivelId",'regraId',plano."regraId",
   'statusMatricula',(SELECT status::text FROM "Matricula" WHERE id=plano."matriculaId")
 );
END $$;

CREATE OR REPLACE FUNCTION autorizacao_preparacao_recuperacao_valida(
  plano "PropostaPlanoRecuperacao", instante TIMESTAMP
) RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE AS $$
BEGIN
 RETURN autorizacao_preparacao_recuperacao_valida_para(plano,plano."autorizacaoPreparacaoId",instante);
END $$;

CREATE OR REPLACE FUNCTION preservar_disponibilizacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE plano "PropostaPlanoRecuperacao"%ROWTYPE; aprovada_em TIMESTAMP; prazo INTEGER; autorizacao_id TEXT;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Disponibilização de recuperação é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO plano FROM "PropostaPlanoRecuperacao" WHERE id=NEW."propostaId" FOR SHARE;
 PERFORM id FROM "Matricula" WHERE id=plano."matriculaId" FOR UPDATE;
 PERFORM id FROM "Usuario" WHERE id=NEW."autorId" AND ativo
   AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Disponibilização exige gestão ativa'; END IF;
 SELECT "criadaEm" INTO aprovada_em FROM "DecisaoPlanoRecuperacao" WHERE "propostaId"=plano.id AND aprovada;
 IF aprovada_em IS NULL OR NEW."disponibilizadaEm"<aprovada_em OR NEW."disponibilizadaEm">clock_timestamp() AT TIME ZONE 'UTC' THEN
   RAISE EXCEPTION 'Disponibilização exige aprovação e data válida';
 END IF;
 IF plano."autorizacaoPreparacaoId" IS NOT NULL AND NEW."autorizacaoPreparacaoId" IS NOT NULL
    AND plano."autorizacaoPreparacaoId" IS DISTINCT FROM NEW."autorizacaoPreparacaoId" THEN
   RAISE EXCEPTION 'Autorizações de preparação da proposta e disponibilização divergem';
 END IF;
 autorizacao_id:=COALESCE(NEW."autorizacaoPreparacaoId",plano."autorizacaoPreparacaoId");
 IF autorizacao_id IS NULL THEN
   IF NOT EXISTS(SELECT 1 FROM "Matricula" m JOIN "AlocacaoTurma" a ON a."matriculaId"=m.id
     WHERE m.id=plano."matriculaId" AND m.status='ATIVA' AND a.id=plano."alocacaoId" AND a.ativa) THEN
     RAISE EXCEPTION 'Disponibilização exige matrícula ativa';
   END IF;
 ELSE
   NEW."autorizacaoPreparacaoId" := autorizacao_id;
   IF NOT autorizacao_preparacao_recuperacao_valida_para(plano,autorizacao_id,clock_timestamp() AT TIME ZONE 'UTC')
      OR NOT autorizacao_preparacao_recuperacao_valida_para(plano,autorizacao_id,NEW."disponibilizadaEm") THEN
     RAISE EXCEPTION 'Autorização especial de preparação inválida';
   END IF;
 END IF;
 SELECT (conteudo->'recuperacao'->>'prazoRealizacaoMinutos')::integer INTO prazo FROM "VersaoRegraAvaliacao" WHERE id=plano."regraId";
 IF prazo IS NULL OR NEW."prazoMinutos"<>prazo OR NEW."prazoAte"<>NEW."disponibilizadaEm"+prazo*interval '1 minute' THEN
   RAISE EXCEPTION 'Prazo incompatível com a regra aprovada';
 END IF;
 IF COALESCE(length(btrim(NEW.condicoes)),0)<5 OR length(NEW.condicoes)>4000
    OR COALESCE(length(btrim(NEW."evidenciaComunicacao")),0)<5 OR length(NEW."evidenciaComunicacao")>4000 THEN
   RAISE EXCEPTION 'Registre condições e evidência de comunicação ao aluno';
 END IF;
 RETURN NEW;
END $$;
