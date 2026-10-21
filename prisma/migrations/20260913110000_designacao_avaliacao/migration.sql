-- CreateTable
CREATE TABLE "DesignacaoAvaliacao" (
    "id" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "professorId" TEXT,
    "gestorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignacaoAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesignacaoAvaliacao_registroId_versao_key" ON "DesignacaoAvaliacao"("registroId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "DesignacaoAvaliacao_gestorId_chaveIdempotencia_key" ON "DesignacaoAvaliacao"("gestorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "DesignacaoAvaliacao" ADD CONSTRAINT "DesignacaoAvaliacao_registroId_fkey" FOREIGN KEY ("registroId") REFERENCES "RegistroAvaliacaoMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DesignacaoAvaliacao" ADD CONSTRAINT "DesignacaoAvaliacao_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DesignacaoAvaliacao" ADD CONSTRAINT "DesignacaoAvaliacao_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_designacao_avaliacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Designações de avaliação são imutáveis'; END IF;
 PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id = NEW."registroId" FOR UPDATE;
 PERFORM id FROM "Usuario" WHERE id = NEW."gestorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Designação exige gestão ativa'; END IF;
 IF NEW."professorId" IS NOT NULL THEN
  PERFORM id FROM "Usuario" WHERE id = NEW."professorId" AND ativo AND 'PROFESSOR'::"Papel" = ANY(papeis) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destinatário deve ser professor ativo'; END IF;
 END IF;
 IF EXISTS (SELECT 1 FROM "VersaoLancamentoAvaliacao" v JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId" = v.id AND d.aprovada WHERE v."registroId" = NEW."registroId") THEN RAISE EXCEPTION 'Avaliação já oficializada'; END IF;
 IF NEW.versao <> COALESCE((SELECT MAX(versao) FROM "DesignacaoAvaliacao" WHERE "registroId" = NEW."registroId"),0) + 1 THEN RAISE EXCEPTION 'Designação desatualizada'; END IF;
 IF length(btrim(NEW.motivo)) < 5 THEN RAISE EXCEPTION 'Justifique a designação'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_designacao_avaliacao BEFORE INSERT OR UPDATE OR DELETE ON "DesignacaoAvaliacao" FOR EACH ROW EXECUTE FUNCTION preservar_designacao_avaliacao();
