-- Q151: fato preparatório; não aprova plano, reserva oportunidade ou registra realização.
CREATE TABLE "AutorizacaoEspecialPreparacaoRecuperacao" (
 "id" TEXT NOT NULL, "alocacaoId" TEXT NOT NULL, "autorizadorId" TEXT NOT NULL, motivo TEXT NOT NULL,
 "prazoAte" TIMESTAMP(3) NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
 "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL, snapshot JSONB NOT NULL,
 CONSTRAINT "AutorizacaoEspecialPreparacaoRecuperacao_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AutorizacaoEspecialPreparacaoRecuperacao_motivo_check" CHECK (length(btrim(motivo)) BETWEEN 5 AND 2000),
 CONSTRAINT "AutorizacaoEspecialPreparacaoRecuperacao_hash_check" CHECK ("entradaHash" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "AutorizacaoEspecialPreparacaoRecuperacao_autorizador_chave_key" ON "AutorizacaoEspecialPreparacaoRecuperacao" ("autorizadorId","chaveIdempotencia");
CREATE INDEX "AutorizacaoEspecialPreparacaoRecuperacao_alocacao_criada_idx" ON "AutorizacaoEspecialPreparacaoRecuperacao" ("alocacaoId","criadaEm");
ALTER TABLE "AutorizacaoEspecialPreparacaoRecuperacao" ADD CONSTRAINT "AutorizacaoEspecialPreparacaoRecuperacao_alocacao_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "AlocacaoTurma"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AutorizacaoEspecialPreparacaoRecuperacao" ADD CONSTRAINT "AutorizacaoEspecialPreparacaoRecuperacao_autorizador_fkey" FOREIGN KEY ("autorizadorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE FUNCTION guardar_autorizacao_especial_preparacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE vinculo "AlocacaoTurma"%ROWTYPE; turma_atual "Turma"%ROWTYPE; matricula_atual "Matricula"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Autorização especial de preparação é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 NEW."criadaEm":=statement_timestamp() AT TIME ZONE 'UTC';
 IF NOT isfinite(NEW."prazoAte") OR NEW."prazoAte"<=NEW."criadaEm" OR length(btrim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' OR length(btrim(NEW."chaveIdempotencia")) NOT BETWEEN 8 AND 100 THEN RAISE EXCEPTION 'Dados da autorização especial de preparação inválidos'; END IF;
 SELECT * INTO vinculo FROM "AlocacaoTurma" WHERE id=NEW."alocacaoId" FOR SHARE;
 IF NOT FOUND OR vinculo."matriculaId" IS NULL THEN RAISE EXCEPTION 'Alocação da preparação inválida'; END IF;
 SELECT * INTO matricula_atual FROM "Matricula" WHERE id=vinculo."matriculaId" FOR UPDATE;
 SELECT * INTO turma_atual FROM "Turma" WHERE id=vinculo."turmaId" FOR SHARE;
 PERFORM id FROM "Usuario" WHERE id=NEW."autorizadorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND OR matricula_atual.status NOT IN ('PAUSADA','ENCERRADA') OR turma_atual."nivelId" IS NULL OR turma_atual."regraAvaliacaoId" IS NULL THEN RAISE EXCEPTION 'Fonte da autorização especial de preparação inválida'; END IF;
 IF NEW.snapshot IS DISTINCT FROM jsonb_build_object('matriculaId',matricula_atual.id,'alocacaoId',vinculo.id,'turmaId',turma_atual.id,'nivelId',turma_atual."nivelId",'regraId',turma_atual."regraAvaliacaoId",'statusMatricula',matricula_atual.status::text) THEN RAISE EXCEPTION 'Snapshot da autorização especial de preparação diverge'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guardar_autorizacao_especial_preparacao_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "AutorizacaoEspecialPreparacaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION guardar_autorizacao_especial_preparacao_recuperacao();
