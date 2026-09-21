-- CreateTable
CREATE TABLE "DesignacaoRecuperacao" (
    "id" TEXT NOT NULL,
    "itemReservaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "professorId" TEXT,
    "gestorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignacaoRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesignacaoRecuperacao_itemReservaId_versao_key" ON "DesignacaoRecuperacao"("itemReservaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "DesignacaoRecuperacao_gestorId_chaveIdempotencia_key" ON "DesignacaoRecuperacao"("gestorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "DesignacaoRecuperacao" ADD CONSTRAINT "DesignacaoRecuperacao_itemReservaId_fkey" FOREIGN KEY ("itemReservaId") REFERENCES "ItemReservaTentativaRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DesignacaoRecuperacao" ADD CONSTRAINT "DesignacaoRecuperacao_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DesignacaoRecuperacao" ADD CONSTRAINT "DesignacaoRecuperacao_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION recuperacao_designada(item_id TEXT, professor_id TEXT, instante TIMESTAMP DEFAULT NULL) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT EXISTS (
  SELECT 1 FROM "ItemReservaTentativaRecuperacao" i WHERE i.id = item_id
   AND (NOT EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" c WHERE c."reservaId" = i."reservaId") OR EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" r WHERE r."itemReservaId" = i.id))
   AND NOT EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" r JOIN "NotaRecuperacao" n ON n."realizacaoId" = r.id JOIN "DecisaoNotaRecuperacao" d ON d."notaId" = n.id AND d.aprovada WHERE r."itemReservaId" = i.id)
   AND (SELECT "professorId" FROM "DesignacaoRecuperacao" WHERE "itemReservaId" = item_id ORDER BY versao DESC LIMIT 1) = professor_id
   AND (instante IS NULL OR (SELECT "professorId" FROM "DesignacaoRecuperacao" WHERE "itemReservaId" = item_id AND "criadaEm" <= instante ORDER BY versao DESC LIMIT 1) = professor_id)
 );
$$;
CREATE FUNCTION preservar_designacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE matricula_id TEXT; ultima "DesignacaoRecuperacao"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Designação de recuperação é imutável'; END IF;
 SELECT p."matriculaId" INTO matricula_id FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" JOIN "PropostaPlanoRecuperacao" p ON p.id = r."propostaId" WHERE i.id = NEW."itemReservaId";
 PERFORM id FROM "Matricula" WHERE id = matricula_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa não encontrada'; END IF;
 PERFORM id FROM "Usuario" WHERE id = NEW."gestorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Designação exige gestão ativa'; END IF;
 IF NEW."professorId" IS NOT NULL THEN
  PERFORM id FROM "Usuario" WHERE id = NEW."professorId" AND ativo AND 'PROFESSOR'::"Papel" = ANY(papeis) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione professor ativo'; END IF;
 END IF;
 IF EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" r JOIN "NotaRecuperacao" n ON n."realizacaoId" = r.id JOIN "DecisaoNotaRecuperacao" d ON d."notaId" = n.id AND d.aprovada WHERE r."itemReservaId" = NEW."itemReservaId") THEN RAISE EXCEPTION 'Tentativa já oficializada'; END IF;
 IF EXISTS (SELECT 1 FROM "ItemReservaTentativaRecuperacao" i JOIN "CancelamentoReservaRecuperacao" c ON c."reservaId" = i."reservaId" WHERE i.id = NEW."itemReservaId") AND NOT EXISTS (SELECT 1 FROM "RealizacaoRecuperacao" r WHERE r."itemReservaId" = NEW."itemReservaId") THEN RAISE EXCEPTION 'Tentativa cancelada sem realização'; END IF;
 SELECT * INTO ultima FROM "DesignacaoRecuperacao" WHERE "itemReservaId" = NEW."itemReservaId" ORDER BY versao DESC LIMIT 1;
 IF NEW.versao <> COALESCE(ultima.versao,0) + 1 THEN RAISE EXCEPTION 'Versão de designação desatualizada'; END IF;
 IF ultima."professorId" IS NOT DISTINCT FROM NEW."professorId" THEN RAISE EXCEPTION 'Designação sem mudança'; END IF;
 IF length(btrim(NEW.motivo)) < 5 OR length(NEW.motivo) > 2000 THEN RAISE EXCEPTION 'Justifique a designação'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_designacao_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "DesignacaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_designacao_recuperacao();

CREATE OR REPLACE FUNCTION preservar_realizacao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE; reserva "ReservaTentativaRecuperacao"%ROWTYPE; disp "DisponibilizacaoPlanoRecuperacao"%ROWTYPE; a "AlocacaoTurma"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Realização de recuperação é imutável'; END IF;
 SELECT r.* INTO reserva FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" r ON r.id = i."reservaId" WHERE i.id = NEW."itemReservaId";
 SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id = reserva."propostaId";
 PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
 IF EXISTS (SELECT 1 FROM "CancelamentoReservaRecuperacao" WHERE "reservaId" = reserva.id) THEN RAISE EXCEPTION 'Tentativa cancelada'; END IF;
 SELECT * INTO disp FROM "DisponibilizacaoPlanoRecuperacao" WHERE "propostaId" = p.id;
 IF disp.id IS NULL OR NEW."realizadaEm" < reserva."criadaEm" OR NEW."realizadaEm" < disp."disponibilizadaEm" OR NEW."realizadaEm" >= prazo_recuperacao_na_data(disp.id, NEW."realizadaEm") OR NEW."realizadaEm" > (clock_timestamp() AT TIME ZONE 'UTC') THEN RAISE EXCEPTION 'Realização fora do período autorizado'; END IF;
 PERFORM id FROM "Usuario" WHERE id = NEW."professorId" AND ativo AND 'PROFESSOR'::"Papel" = ANY(papeis) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Realização exige professor ativo'; END IF;
 SELECT * INTO a FROM "AlocacaoTurma" WHERE id = p."alocacaoId";
 IF NEW."realizadaEm" < a."criadoEm" OR (a."encerradaEm" IS NOT NULL AND NEW."realizadaEm" >= a."encerradaEm") OR (NOT a.ativa AND a."encerradaEm" IS NULL) THEN RAISE EXCEPTION 'Realização fora do vínculo do aluno'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Turma" t JOIN "VinculoDocente" v ON v."turmaId" = t.id WHERE t.id = a."turmaId" AND t."professorId" = NEW."professorId" AND t.status <> 'CONCLUIDA' AND v."professorId" = NEW."professorId" AND v.fim IS NULL AND v.inicio <= NEW."realizadaEm") AND NOT recuperacao_designada(NEW."itemReservaId", NEW."professorId", NEW."realizadaEm") THEN RAISE EXCEPTION 'Professor sem atribuição para recuperação'; END IF;
 IF COALESCE(length(btrim(NEW.evidencia)),0) < 5 OR length(NEW.evidencia) > 4000 THEN RAISE EXCEPTION 'Registre evidência da realização'; END IF;
 RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION preservar_nota_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "RealizacaoRecuperacao"%ROWTYPE; p "PropostaPlanoRecuperacao"%ROWTYPE; n "NotaRecuperacao"%ROWTYPE; regra JSONB; ultima INTEGER;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Notas e decisões de recuperação são imutáveis'; END IF;
 IF TG_TABLE_NAME = 'NotaRecuperacao' THEN
  SELECT * INTO r FROM "RealizacaoRecuperacao" WHERE id = NEW."realizacaoId";
 ELSE
  SELECT * INTO n FROM "NotaRecuperacao" WHERE id = NEW."notaId";
  SELECT * INTO r FROM "RealizacaoRecuperacao" WHERE id = n."realizacaoId";
 END IF;
 SELECT plano.* INTO p FROM "ItemReservaTentativaRecuperacao" i JOIN "ReservaTentativaRecuperacao" reserva ON reserva.id = i."reservaId" JOIN "PropostaPlanoRecuperacao" plano ON plano.id = reserva."propostaId" WHERE i.id = r."itemReservaId";
 IF p.id IS NULL THEN RAISE EXCEPTION 'Realização obrigatória'; END IF;
 PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
 SELECT COALESCE(max(versao),0) INTO ultima FROM "NotaRecuperacao" WHERE "realizacaoId" = r.id;
 IF TG_TABLE_NAME = 'NotaRecuperacao' THEN
  PERFORM id FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND 'PROFESSOR'::"Papel" = ANY(papeis) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Professor sem autoria da recuperação'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id = a."turmaId" JOIN "VinculoDocente" v ON v."turmaId" = t.id WHERE a.id = p."alocacaoId" AND t."professorId" = NEW."autorId" AND t.status <> 'CONCLUIDA' AND v."professorId" = NEW."autorId" AND v.fim IS NULL AND r."professorId" = NEW."autorId") AND NOT recuperacao_designada(r."itemReservaId", NEW."autorId") THEN RAISE EXCEPTION 'Professor sem atribuição vigente'; END IF;
  IF NEW.versao <> ultima + 1 THEN RAISE EXCEPTION 'Versão de nota desatualizada'; END IF;
  IF EXISTS (SELECT 1 FROM "NotaRecuperacao" anterior JOIN "DecisaoNotaRecuperacao" d ON d."notaId" = anterior.id AND d.aprovada WHERE anterior."realizacaoId" = r.id) THEN RAISE EXCEPTION 'Nota oficial exige correção própria'; END IF;
  SELECT conteudo INTO regra FROM "VersaoRegraAvaliacao" WHERE id = p."regraId";
  IF NEW.submetida AND NEW.nota IS NULL THEN RAISE EXCEPTION 'Submissão exige nota'; END IF;
  IF NEW.nota IS NOT NULL THEN
   IF length(NEW.nota) > 100 OR NEW.nota !~ '^-?[0-9]+(\.[0-9]+)?$' THEN RAISE EXCEPTION 'Nota decimal inválida'; END IF;
   IF NEW.nota::numeric < (regra->'escala'->>'minimo')::numeric OR NEW.nota::numeric > (regra->'escala'->>'maximo')::numeric THEN RAISE EXCEPTION 'Nota fora da escala'; END IF;
  END IF;
  IF length(NEW."comentarioAluno") > 2000 THEN RAISE EXCEPTION 'Comentário excede limite'; END IF;
 ELSE
  PERFORM id FROM "Usuario" WHERE id = NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige gestão ativa'; END IF;
  IF NEW."decisorId" IN (n."autorId", r."professorId") THEN RAISE EXCEPTION 'Outra pessoa deve conferir a nota'; END IF;
  IF NOT n.submetida OR n.nota IS NULL THEN RAISE EXCEPTION 'Nota não submetida'; END IF;
  IF NEW.aprovada AND n.versao <> ultima THEN RAISE EXCEPTION 'Existe versão mais recente'; END IF;
  IF length(btrim(NEW.motivo)) < 5 OR length(NEW.motivo) > 2000 THEN RAISE EXCEPTION 'Justifique a decisão'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
