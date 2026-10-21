ALTER TABLE "PropostaPlanoRecuperacao" ADD COLUMN "autorizacaoPreparacaoId" TEXT;
ALTER TABLE "PropostaPlanoRecuperacao" ADD CONSTRAINT "PropostaPlanoRecuperacao_autorizacaoPreparacaoId_fkey" FOREIGN KEY ("autorizacaoPreparacaoId") REFERENCES "AutorizacaoEspecialPreparacaoRecuperacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE OR REPLACE FUNCTION preservar_proposta_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE papeis_autor "Papel"[]; autorizacao "AutorizacaoEspecialPreparacaoRecuperacao"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta de recuperação é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM id FROM "Matricula" WHERE id=NEW."matriculaId" FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta exige matrícula válida'; END IF;
 IF NEW."autorizacaoPreparacaoId" IS NULL THEN
  PERFORM id FROM "Matricula" WHERE id=NEW."matriculaId" AND status='ATIVA';
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta exige matrícula ativa'; END IF;
  IF NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId" WHERE a.id=NEW."alocacaoId" AND a.ativa AND a."matriculaId"=NEW."matriculaId" AND t."nivelId"=NEW."nivelId" AND t."regraAvaliacaoId"=NEW."regraId") THEN RAISE EXCEPTION 'Vínculo, nível ou regra incompatível com a proposta'; END IF;
 ELSE
  SELECT * INTO autorizacao FROM "AutorizacaoEspecialPreparacaoRecuperacao" WHERE id=NEW."autorizacaoPreparacaoId" FOR SHARE;
  PERFORM id FROM "Usuario" WHERE id=autorizacao."autorizadorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
  IF NOT FOUND OR autorizacao."alocacaoId" IS DISTINCT FROM NEW."alocacaoId" OR NOT isfinite(autorizacao."prazoAte") OR autorizacao."criadaEm">clock_timestamp() AT TIME ZONE 'UTC' OR autorizacao."prazoAte"<=clock_timestamp() AT TIME ZONE 'UTC' OR NOT EXISTS(SELECT 1 FROM "Matricula" WHERE id=NEW."matriculaId" AND status IN ('PAUSADA','ENCERRADA')) OR NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId" WHERE a.id=NEW."alocacaoId" AND a."matriculaId"=NEW."matriculaId" AND t."nivelId"=NEW."nivelId" AND t."regraAvaliacaoId"=NEW."regraId") OR autorizacao.snapshot IS DISTINCT FROM jsonb_build_object('matriculaId',NEW."matriculaId",'alocacaoId',NEW."alocacaoId",'turmaId',(SELECT "turmaId" FROM "AlocacaoTurma" WHERE id=NEW."alocacaoId"),'nivelId',NEW."nivelId",'regraId',NEW."regraId",'statusMatricula',(SELECT status::text FROM "Matricula" WHERE id=NEW."matriculaId")) THEN RAISE EXCEPTION 'Autorização especial de preparação inválida'; END IF;
 END IF;
 SELECT papeis INTO papeis_autor FROM "Usuario" WHERE id=NEW."preparadorId" AND ativo FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Preparador inativo'; END IF;
 IF NOT (papeis_autor && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN IF NOT ('PROFESSOR'::"Papel"=ANY(papeis_autor)) OR NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId" JOIN "VinculoDocente" v ON v."turmaId"=t.id AND v."professorId"=NEW."preparadorId" WHERE a.id=NEW."alocacaoId" AND t."professorId"=NEW."preparadorId" AND t.status<>'CONCLUIDA' AND v.fim IS NULL AND v.inicio<=clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Preparador sem atribuição para o plano'; END IF; END IF;
 IF NEW.versao<>(SELECT COALESCE(MAX(versao),0)+1 FROM "PropostaPlanoRecuperacao" WHERE "matriculaId"=NEW."matriculaId" AND "nivelId"=NEW."nivelId") THEN RAISE EXCEPTION 'Versão de plano desatualizada'; END IF;
 RETURN NEW;
END $$;
