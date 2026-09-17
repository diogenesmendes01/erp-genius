-- M01/206: Q23 é uma projeção imutável; a resolução conserva a publicação exata.
BEGIN;
ALTER TABLE "ResolucaoDivergenciaPresencaHistoricaMigracao"
  ADD COLUMN "correcaoId" text,
  ADD COLUMN "correcaoVersao" integer,
  ADD COLUMN "correcaoAprovacaoId" text;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ResolucaoDivergenciaPresencaHistoricaMigracao" WHERE resultado='RECONCILIADA') THEN
    RAISE EXCEPTION 'M01/206 exige revisão manual das reconciliações anteriores sem fotografia Q23';
  END IF;
END $$;

ALTER TABLE "ResolucaoDivergenciaPresencaHistoricaMigracao"
  ADD CONSTRAINT "ResolucaoPresenca_correcao_fkey" FOREIGN KEY ("correcaoId") REFERENCES "PropostaCorrecaoAula"(id) ON DELETE RESTRICT,
  ADD CONSTRAINT "ResolucaoPresenca_correcao_aprovacao_fkey" FOREIGN KEY ("correcaoAprovacaoId") REFERENCES "AprovacaoCorrecaoAula"(id) ON DELETE RESTRICT,
  ADD CONSTRAINT "ResolucaoPresenca_correcao_check" CHECK ((resultado='MANTIDA' AND "correcaoId" IS NULL AND "correcaoVersao" IS NULL AND "correcaoAprovacaoId" IS NULL) OR (resultado='RECONCILIADA' AND "correcaoId" IS NOT NULL AND "correcaoVersao" IS NOT NULL AND "correcaoVersao">0 AND "correcaoAprovacaoId" IS NOT NULL));

CREATE OR REPLACE FUNCTION "m01_presenca_historica_resolucao_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a record; p record; r record; q23 record;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Resolução de divergência M01 é append-only'; END IF;
  SELECT * INTO a FROM "AplicacaoPresencaHistoricaMigracao" WHERE id=NEW."aplicacaoId";
  SELECT * INTO p FROM "PropostaPresencaHistoricaMigracao" WHERE id=a."propostaId";
  SELECT * INTO r FROM "RegistroAulaAluno" WHERE id=NEW."registroId";
  IF a.resultado IS DISTINCT FROM 'DIVERGENCIA' OR p.status IS DISTINCT FROM 'PENDENCIA_CORRECAO' OR a."registroExistenteId" IS DISTINCT FROM NEW."registroId" OR r."aulaId" IS DISTINCT FROM p."aulaId" OR r."matriculaId" IS DISTINCT FROM p."matriculaId" OR NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."resolvedorId" AND u.ativo AND ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))) THEN RAISE EXCEPTION 'Resolução M01 não corresponde à divergência acadêmica'; END IF;
  IF NEW.resultado='RECONCILIADA' THEN
    SELECT q.id,q.versao,ap.id AS aprovacao_id,q."snapshotNovo" INTO q23 FROM "PropostaCorrecaoAula" q JOIN "AprovacaoCorrecaoAula" ap ON ap."propostaId"=q.id JOIN "AulaDiario" d ON d."encontroId"=q."encontroId" WHERE d.id=p."aulaId" AND q.id=NEW."correcaoId" AND q.versao=NEW."correcaoVersao" AND ap.id=NEW."correcaoAprovacaoId" ORDER BY q.versao DESC LIMIT 1;
    IF q23.id IS NULL OR EXISTS (SELECT 1 FROM "PropostaCorrecaoAula" q JOIN "AprovacaoCorrecaoAula" ap ON ap."propostaId"=q.id JOIN "AulaDiario" d ON d."encontroId"=q."encontroId" WHERE d.id=p."aulaId" AND q.versao>q23.versao) OR NOT jsonb_path_exists(q23."snapshotNovo", '$.registros[*] ? (@.registroId == $registro && @.alunoId == $aluno && @.matriculaId == $matricula && @.participacao == $participacao && @.presente == $presente)', jsonb_build_object('registro',NEW."registroId",'aluno',r."alunoId",'matricula',r."matriculaId",'participacao',p.participacao,'presente',(p.participacao='PRESENTE'::"ParticipacaoAula"))) THEN RAISE EXCEPTION 'Correção Q23 vigente não coincide com a presença histórica'; END IF;
  END IF;
  RETURN NEW;
END $$;
COMMIT;
