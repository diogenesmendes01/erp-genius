-- CreateTable
CREATE TABLE "NotaRecuperacao" (
    "id" TEXT NOT NULL,
    "realizacaoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "nota" TEXT,
    "comentarioAluno" TEXT NOT NULL,
    "submetida" BOOLEAN NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoNotaRecuperacao" (
    "id" TEXT NOT NULL,
    "notaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoNotaRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotaRecuperacao_realizacaoId_versao_key" ON "NotaRecuperacao"("realizacaoId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "NotaRecuperacao_autorId_chaveIdempotencia_key" ON "NotaRecuperacao"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoNotaRecuperacao_notaId_key" ON "DecisaoNotaRecuperacao"("notaId");

-- AddForeignKey
ALTER TABLE "NotaRecuperacao" ADD CONSTRAINT "NotaRecuperacao_realizacaoId_fkey" FOREIGN KEY ("realizacaoId") REFERENCES "RealizacaoRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "NotaRecuperacao" ADD CONSTRAINT "NotaRecuperacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoNotaRecuperacao" ADD CONSTRAINT "DecisaoNotaRecuperacao_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "NotaRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoNotaRecuperacao" ADD CONSTRAINT "DecisaoNotaRecuperacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_nota_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF NOT FOUND OR NEW."autorId" <> r."professorId" THEN RAISE EXCEPTION 'Professor sem autoria da recuperação'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id = a."turmaId" JOIN "VinculoDocente" v ON v."turmaId" = t.id WHERE a.id = p."alocacaoId" AND t."professorId" = NEW."autorId" AND t.status <> 'CONCLUIDA' AND v."professorId" = NEW."autorId" AND v.fim IS NULL) THEN RAISE EXCEPTION 'Professor sem atribuição vigente'; END IF;
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
CREATE TRIGGER preservar_nota_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "NotaRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_nota_recuperacao();
CREATE TRIGGER preservar_decisao_nota_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoNotaRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_nota_recuperacao();
