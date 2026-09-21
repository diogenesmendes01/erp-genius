CREATE TABLE "PropostaSubstituicaoRecuperacao" (
 id TEXT NOT NULL PRIMARY KEY, "encontroId" TEXT NOT NULL, "autorId" TEXT NOT NULL, "substitutoId" TEXT NOT NULL,
 versao INTEGER NOT NULL, motivo TEXT NOT NULL, snapshot JSONB NOT NULL,
 "chaveIdempotencia" TEXT NOT NULL, "entradaHash" TEXT NOT NULL, "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PropostaSubstituicaoRecuperacao_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "PropostaSubstituicaoRecuperacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "PropostaSubstituicaoRecuperacao_substitutoId_fkey" FOREIGN KEY ("substitutoId") REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CHECK (versao>0 AND length(trim(motivo)) BETWEEN 5 AND 2000 AND jsonb_typeof(snapshot)='object')
);
CREATE UNIQUE INDEX "substituicao_recuperacao_versao_key" ON "PropostaSubstituicaoRecuperacao"("encontroId",versao);
CREATE UNIQUE INDEX "substituicao_recuperacao_chave_key" ON "PropostaSubstituicaoRecuperacao"("autorId","chaveIdempotencia");
CREATE FUNCTION preservar_proposta_substituicao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "EncontroAgenda"%ROWTYPE; item_id TEXT; plano "PropostaPlanoRecuperacao"%ROWTYPE; versao_atual INTEGER;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta de substituição é imutável'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO e FROM "EncontroAgenda" WHERE id=NEW."encontroId";
 PERFORM id FROM "Matricula" WHERE id=e."matriculaId" AND status='ATIVA' FOR UPDATE;
 IF NOT FOUND OR e.finalidade<>'RECUPERACAO' OR e.status<>'PREVISTO' OR e.inicio <= (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Substituição exige recuperação futura e matrícula ativa'; END IF;
 SELECT "itemReservaId" INTO item_id FROM "PropostaAgendaRecuperacao" WHERE id=e."propostaAgendaRecuperacaoId";
 SELECT pl.* INTO plano FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id=i."reservaId" JOIN "PropostaPlanoRecuperacao" pl ON pl.id=r."propostaId" WHERE i.id=item_id;
 IF EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" WHERE "itemReservaId"=item_id) OR EXISTS (SELECT 1 FROM "ItemReservaTentativaRecuperacao" i JOIN "CancelamentoReservaRecuperacao" c ON c."reservaId"=i."reservaId" WHERE i.id=item_id) THEN RAISE EXCEPTION 'Tentativa já realizada ou cancelada'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."autorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta exige gestão ativa'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."substitutoId" AND ativo AND 'PROFESSOR'::"Papel"=ANY(papeis) FOR SHARE;
 IF NOT FOUND OR NEW."substitutoId" IS NOT DISTINCT FROM e."professorId" THEN RAISE EXCEPTION 'Escolha outro professor ativo'; END IF;
 SELECT coalesce(max(versao),0) INTO versao_atual FROM "PropostaSubstituicaoRecuperacao" WHERE "encontroId"=e.id;
 IF NEW.versao<>versao_atual+1 THEN RAISE EXCEPTION 'Existe versão mais recente da substituição'; END IF;
 IF NEW.snapshot->>'encontroId' IS DISTINCT FROM e.id OR NEW.snapshot->>'itemReservaId' IS DISTINCT FROM item_id OR NEW.snapshot->>'avaliadorAtualId' IS DISTINCT FROM e."professorId" OR NEW.snapshot->>'substitutoId' IS DISTINCT FROM NEW."substitutoId" OR NEW.snapshot->>'matriculaId' IS DISTINCT FROM e."matriculaId" OR NEW.snapshot->>'planoHash' IS DISTINCT FROM plano."entradaHash" OR (NEW.snapshot->>'inicio')::timestamp IS DISTINCT FROM e.inicio OR (NEW.snapshot->>'fim')::timestamp IS DISTINCT FROM e.fim OR NEW.snapshot->>'fusoOrigem' IS DISTINCT FROM e."fusoOrigem" THEN RAISE EXCEPTION 'Origem da substituição diverge da conferência'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preservar_proposta_substituicao_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "PropostaSubstituicaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_proposta_substituicao_recuperacao();
