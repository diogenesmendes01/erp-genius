-- CreateTable
CREATE TABLE "PropostaCorrecaoRecuperacao" (
    "id" TEXT NOT NULL,
    "notaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "origemId" TEXT NOT NULL,
    "nota" TEXT NOT NULL,
    "comentarioAluno" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaCorrecaoRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoCorrecaoRecuperacao" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "impactos" JSONB NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoCorrecaoRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCorrecaoRecuperacao_notaId_versao_key" ON "PropostaCorrecaoRecuperacao"("notaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCorrecaoRecuperacao_autorId_chaveIdempotencia_key" ON "PropostaCorrecaoRecuperacao"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoCorrecaoRecuperacao_propostaId_key" ON "DecisaoCorrecaoRecuperacao"("propostaId");

-- AddForeignKey
ALTER TABLE "PropostaCorrecaoRecuperacao" ADD CONSTRAINT "PropostaCorrecaoRecuperacao_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "NotaRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaCorrecaoRecuperacao" ADD CONSTRAINT "PropostaCorrecaoRecuperacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCorrecaoRecuperacao" ADD CONSTRAINT "DecisaoCorrecaoRecuperacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaCorrecaoRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCorrecaoRecuperacao" ADD CONSTRAINT "DecisaoCorrecaoRecuperacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_correcao_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n "NotaRecuperacao"%ROWTYPE; p "PropostaCorrecaoRecuperacao"%ROWTYPE; plano "PropostaPlanoRecuperacao"%ROWTYPE; vigente TEXT; ultima INTEGER; regra JSONB;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Correções e decisões são imutáveis'; END IF;
 IF TG_TABLE_NAME = 'PropostaCorrecaoRecuperacao' THEN
   SELECT * INTO n FROM "NotaRecuperacao" WHERE id = NEW."notaId";
 ELSE
   SELECT * INTO p FROM "PropostaCorrecaoRecuperacao" WHERE id = NEW."propostaId";
   SELECT * INTO n FROM "NotaRecuperacao" WHERE id = p."notaId";
 END IF;
 SELECT pp.* INTO plano FROM "RealizacaoRecuperacao" r JOIN "ItemReservaTentativaRecuperacao" i ON i.id = r."itemReservaId" JOIN "ReservaTentativaRecuperacao" re ON re.id = i."reservaId" JOIN "PropostaPlanoRecuperacao" pp ON pp.id = re."propostaId" WHERE r.id = n."realizacaoId";
 IF plano.id IS NULL THEN RAISE EXCEPTION 'Nota vinculada obrigatória'; END IF;
 PERFORM id FROM "Matricula" WHERE id = plano."matriculaId" FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "DecisaoNotaRecuperacao" WHERE "notaId" = n.id AND aprovada) OR n.nota IS NULL THEN RAISE EXCEPTION 'Correção exige nota oficial'; END IF;
 SELECT c.id INTO vigente FROM "PropostaCorrecaoRecuperacao" c JOIN "DecisaoCorrecaoRecuperacao" d ON d."propostaId" = c.id AND d.aprovada WHERE c."notaId" = n.id ORDER BY c.versao DESC LIMIT 1;
 vigente := COALESCE(vigente, n.id);
 SELECT COALESCE(max(versao),0) INTO ultima FROM "PropostaCorrecaoRecuperacao" WHERE "notaId" = n.id;
 IF TG_TABLE_NAME = 'PropostaCorrecaoRecuperacao' THEN
   PERFORM id FROM "Usuario" WHERE id = NEW."autorId" AND ativo AND (papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] OR ('PROFESSOR'::"Papel" = ANY(papeis) AND EXISTS (SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id = a."turmaId" JOIN "VinculoDocente" v ON v."turmaId" = t.id WHERE a.id = plano."alocacaoId" AND t."professorId" = NEW."autorId" AND t.status <> 'CONCLUIDA' AND v."professorId" = NEW."autorId" AND v.fim IS NULL AND v.inicio <= (clock_timestamp() AT TIME ZONE 'UTC')))) FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Autor sem atribuição vigente'; END IF;
   IF NEW.versao <> ultima + 1 OR NEW."origemId" <> vigente THEN RAISE EXCEPTION 'Origem ou versão desatualizada'; END IF;
   SELECT conteudo INTO regra FROM "VersaoRegraAvaliacao" WHERE id = plano."regraId";
   IF NEW.nota !~ '^-?[0-9]+(\.[0-9]+)?$' OR length(NEW.nota) > 100 THEN RAISE EXCEPTION 'Nota decimal inválida'; END IF;
   IF NEW.nota::numeric < (regra->'escala'->>'minimo')::numeric OR NEW.nota::numeric > (regra->'escala'->>'maximo')::numeric THEN RAISE EXCEPTION 'Nota fora da escala'; END IF;
   IF length(NEW."comentarioAluno") > 2000 THEN RAISE EXCEPTION 'Comentário excede limite'; END IF;
 ELSE
   PERFORM id FROM "Usuario" WHERE id = NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
   IF NOT FOUND OR NEW."decisorId" = p."autorId" THEN RAISE EXCEPTION 'Decisão exige outra pessoa da gestão'; END IF;
   IF NEW.aprovada AND (p.versao <> ultima OR p."origemId" <> vigente) THEN RAISE EXCEPTION 'Proposta desatualizada'; END IF;
 END IF;
 IF length(btrim(NEW.motivo)) < 5 OR length(NEW.motivo) > 2000 THEN RAISE EXCEPTION 'Justifique a operação'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_correcao_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "PropostaCorrecaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_correcao_recuperacao();
CREATE TRIGGER preservar_decisao_correcao_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoCorrecaoRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_correcao_recuperacao();
