CREATE TABLE "AutorizacaoEspecialReservaRecuperacao" (
 "id" TEXT NOT NULL, "propostaId" TEXT NOT NULL, habilidade TEXT NOT NULL, "autorizadorId" TEXT NOT NULL,
 motivo TEXT NOT NULL, "prazoAte" TIMESTAMP(3) NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
 "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL, snapshot JSONB NOT NULL,
 CONSTRAINT "AutorizacaoEspecialReservaRecuperacao_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AutorizacaoEspecialReservaRecuperacao_motivo_check" CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000),
 CONSTRAINT "AutorizacaoEspecialReservaRecuperacao_hash_check" CHECK ("entradaHash" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "AutorizacaoEspecialReservaRecuperacao_autorizador_chave_key" ON "AutorizacaoEspecialReservaRecuperacao" ("autorizadorId","chaveIdempotencia");
CREATE INDEX "AutorizacaoEspecialReservaRecuperacao_proposta_habilidade_prazo_idx" ON "AutorizacaoEspecialReservaRecuperacao" ("propostaId",habilidade,"prazoAte");
ALTER TABLE "AutorizacaoEspecialReservaRecuperacao" ADD CONSTRAINT "AutorizacaoEspecialReservaRecuperacao_proposta_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaPlanoRecuperacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AutorizacaoEspecialReservaRecuperacao" ADD CONSTRAINT "AutorizacaoEspecialReservaRecuperacao_autorizador_fkey" FOREIGN KEY ("autorizadorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ReservaTentativaRecuperacao" ADD COLUMN "autorizacaoEspecialReservaId" TEXT;
ALTER TABLE "ReservaTentativaRecuperacao" ADD CONSTRAINT "ReservaTentativaRecuperacao_autorizacaoEspecialReservaId_fkey" FOREIGN KEY ("autorizacaoEspecialReservaId") REFERENCES "AutorizacaoEspecialReservaRecuperacao"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "ReservaTentativaRecuperacao_autorizacaoEspecialReservaId_key" ON "ReservaTentativaRecuperacao" ("autorizacaoEspecialReservaId");

CREATE FUNCTION guardar_autorizacao_especial_reserva_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE; d TEXT; v TEXT;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Autorização especial de reserva é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 NEW."criadaEm":=statement_timestamp() AT TIME ZONE 'UTC';
 IF length(btrim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' OR length(btrim(NEW."chaveIdempotencia")) NOT BETWEEN 8 AND 100 OR NOT isfinite(NEW."prazoAte") OR NEW."prazoAte"<=NEW."criadaEm" THEN RAISE EXCEPTION 'Dados da autorização especial de reserva inválidos'; END IF;
 SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id=NEW."propostaId" FOR SHARE;
 PERFORM id FROM "Usuario" WHERE id=NEW."autorizadorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Autorização especial de reserva exige gestão ativa'; END IF;
 PERFORM id FROM "Matricula" WHERE id=p."matriculaId" AND status IN ('PAUSADA','ENCERRADA') FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM "DecisaoPlanoRecuperacao" WHERE "propostaId"=p.id AND aprovada) OR NOT EXISTS(SELECT 1 FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId"=p.id) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.atividades) x WHERE x->>'habilidade'=NEW.habilidade) THEN RAISE EXCEPTION 'Fonte da autorização especial de reserva inválida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id=a."turmaId" WHERE a.id=p."alocacaoId" AND a."matriculaId"=p."matriculaId" AND t."nivelId"=p."nivelId" AND t."regraAvaliacaoId"=p."regraId") THEN RAISE EXCEPTION 'Vínculo do plano diverge'; END IF;
 SELECT id INTO d FROM "DecisaoPlanoRecuperacao" WHERE "propostaId"=p.id AND aprovada; SELECT id INTO v FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId"=p.id;
 IF NEW.snapshot IS DISTINCT FROM jsonb_build_object('matriculaId',p."matriculaId",'alocacaoId',p."alocacaoId",'regraId',p."regraId",'propostaId',p.id,'propostaHash',p."entradaHash",'decisaoId',d,'disponibilizacaoId',v,'habilidade',NEW.habilidade,'statusMatricula',(SELECT status::text FROM "Matricula" WHERE id=p."matriculaId")) THEN RAISE EXCEPTION 'Snapshot da autorização especial de reserva diverge'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guardar_autorizacao_especial_reserva_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "AutorizacaoEspecialReservaRecuperacao" FOR EACH ROW EXECUTE FUNCTION guardar_autorizacao_especial_reserva_recuperacao();

CREATE OR REPLACE FUNCTION preservar_reserva_tentativa_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE; limite BIGINT; ocupadas BIGINT; a "AutorizacaoEspecialReservaRecuperacao"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Reserva de tentativa é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 IF TG_TABLE_NAME='ReservaTentativaRecuperacao' THEN
  SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id=NEW."propostaId";
  PERFORM id FROM "Matricula" WHERE id=p."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula não encontrada'; END IF;
  PERFORM id FROM "Usuario" WHERE id=NEW."autorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Reserva exige gestão ativa'; END IF;
  IF NOT EXISTS(SELECT 1 FROM "DecisaoPlanoRecuperacao" WHERE "propostaId"=p.id AND aprovada) OR NOT EXISTS(SELECT 1 FROM "DisponibilizacaoPlanoRecuperacao" d WHERE "propostaId"=p.id AND d."disponibilizadaEm"<=clock_timestamp() AT TIME ZONE 'UTC' AND prazo_recuperacao_vigente(d.id)>clock_timestamp() AT TIME ZONE 'UTC') OR NOT EXISTS(SELECT 1 FROM "AlocacaoTurma" x JOIN "Turma" t ON t.id=x."turmaId" WHERE x.id=p."alocacaoId" AND x."matriculaId"=p."matriculaId" AND t."nivelId"=p."nivelId" AND t."regraAvaliacaoId"=p."regraId") THEN RAISE EXCEPTION 'Fonte da reserva inválida'; END IF;
  IF NEW."autorizacaoEspecialReservaId" IS NULL THEN
   IF NOT EXISTS(SELECT 1 FROM "Matricula" m JOIN "AlocacaoTurma" x ON x."matriculaId"=m.id WHERE m.id=p."matriculaId" AND m.status='ATIVA' AND x.id=p."alocacaoId" AND x.ativa) THEN RAISE EXCEPTION 'Reserva exige matrícula e vínculo ativos'; END IF;
  ELSE
   SELECT * INTO a FROM "AutorizacaoEspecialReservaRecuperacao" WHERE id=NEW."autorizacaoEspecialReservaId" FOR SHARE;
   IF NOT FOUND OR a."propostaId" IS DISTINCT FROM p.id OR NOT isfinite(a."prazoAte") OR a."criadaEm">clock_timestamp() AT TIME ZONE 'UTC' OR a."prazoAte"<=clock_timestamp() AT TIME ZONE 'UTC' OR NOT EXISTS(SELECT 1 FROM "Usuario" WHERE id=a."autorizadorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE) OR NOT EXISTS(SELECT 1 FROM "Matricula" WHERE id=p."matriculaId" AND status IN ('PAUSADA','ENCERRADA')) OR a.snapshot IS DISTINCT FROM jsonb_build_object('matriculaId',p."matriculaId",'alocacaoId',p."alocacaoId",'regraId',p."regraId",'propostaId',p.id,'propostaHash',p."entradaHash",'decisaoId',(SELECT id FROM "DecisaoPlanoRecuperacao" WHERE "propostaId"=p.id AND aprovada),'disponibilizacaoId',(SELECT id FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId"=p.id),'habilidade',a.habilidade,'statusMatricula',(SELECT status::text FROM "Matricula" WHERE id=p."matriculaId")) THEN RAISE EXCEPTION 'Autorização especial de reserva inválida'; END IF;
  END IF;
 ELSE
  SELECT plano.* INTO p FROM "ReservaTentativaRecuperacao" r JOIN "PropostaPlanoRecuperacao" plano ON plano.id=r."propostaId" WHERE r.id=NEW."reservaId";
  PERFORM id FROM "Matricula" WHERE id=p."matriculaId" FOR UPDATE;
  IF EXISTS(SELECT 1 FROM "CancelamentoReservaRecuperacao" WHERE "reservaId"=NEW."reservaId") OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.atividades) x WHERE x->>'habilidade'=NEW.habilidade) THEN RAISE EXCEPTION 'Item de reserva inválido'; END IF;
  IF EXISTS(SELECT 1 FROM "ReservaTentativaRecuperacao" r JOIN "AutorizacaoEspecialReservaRecuperacao" a ON a.id=r."autorizacaoEspecialReservaId" WHERE r.id=NEW."reservaId" AND (a.habilidade IS DISTINCT FROM NEW.habilidade OR a."propostaId" IS DISTINCT FROM p.id OR NOT isfinite(a."prazoAte") OR a."criadaEm">clock_timestamp() AT TIME ZONE 'UTC' OR a."prazoAte"<=clock_timestamp() AT TIME ZONE 'UTC' OR EXISTS(SELECT 1 FROM "RealizacaoRecuperacao" z JOIN "ItemReservaTentativaRecuperacao" i ON i.id=z."itemReservaId" WHERE i."reservaId"=r.id) OR NOT EXISTS(SELECT 1 FROM "Usuario" u WHERE u.id=a."autorizadorId" AND u.ativo AND u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE) OR NOT EXISTS(SELECT 1 FROM "Matricula" m JOIN "AlocacaoTurma" x ON x."matriculaId"=m.id JOIN "Turma" t ON t.id=x."turmaId" WHERE m.id=p."matriculaId" AND m.status IN ('PAUSADA','ENCERRADA') AND x.id=p."alocacaoId" AND t."nivelId"=p."nivelId" AND t."regraAvaliacaoId"=p."regraId") OR NOT EXISTS(SELECT 1 FROM "DisponibilizacaoPlanoRecuperacao" d WHERE d."propostaId"=p.id AND d."disponibilizadaEm"<=clock_timestamp() AT TIME ZONE 'UTC' AND prazo_recuperacao_vigente(d.id)>clock_timestamp() AT TIME ZONE 'UTC') OR a.snapshot IS DISTINCT FROM jsonb_build_object('matriculaId',p."matriculaId",'alocacaoId',p."alocacaoId",'regraId',p."regraId",'propostaId',p.id,'propostaHash',p."entradaHash",'decisaoId',(SELECT id FROM "DecisaoPlanoRecuperacao" WHERE "propostaId"=p.id AND aprovada),'disponibilizacaoId',(SELECT id FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId"=p.id),'habilidade',a.habilidade,'statusMatricula',(SELECT status::text FROM "Matricula" WHERE id=p."matriculaId")))) THEN RAISE EXCEPTION 'Autorização especial não permite esta habilidade'; END IF;
  SELECT (h->>'limiteRecuperacoes')::bigint INTO limite FROM "VersaoRegraAvaliacao" regra,jsonb_array_elements(regra.conteudo->'habilidades') h WHERE regra.id=p."regraId" AND h->>'habilidade'=NEW.habilidade;
  SELECT count(*) INTO ocupadas FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id=i."reservaId" JOIN "PropostaPlanoRecuperacao" q ON q.id=r."propostaId" WHERE q."matriculaId"=p."matriculaId" AND q."nivelId"=p."nivelId" AND i.habilidade=NEW.habilidade AND (NOT EXISTS(SELECT 1 FROM "CancelamentoReservaRecuperacao" c WHERE c."reservaId"=r.id) OR EXISTS(SELECT 1 FROM "RealizacaoRecuperacao" z WHERE z."itemReservaId"=i.id));
  limite:=limite+(SELECT coalesce(sum(e.quantidade),0) FROM "PropostaExtraRecuperacao" e JOIN "DecisaoExtraRecuperacao" d ON d."propostaId"=e.id AND d.aprovada WHERE e."matriculaId"=p."matriculaId" AND e."nivelId"=p."nivelId" AND e.habilidade=NEW.habilidade);
  IF limite IS NULL OR ocupadas>=limite THEN RAISE EXCEPTION 'Limite de tentativas da habilidade esgotado'; END IF;
 END IF; RETURN NEW;
END $$;
