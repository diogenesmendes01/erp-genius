-- CreateTable
CREATE TABLE "PropostaPlanoRecuperacao" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "alocacaoId" TEXT NOT NULL,
    "nivelId" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "atividades" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaPlanoRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaPlanoRecuperacao_matriculaId_nivelId_versao_key" ON "PropostaPlanoRecuperacao"("matriculaId", "nivelId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaPlanoRecuperacao_preparadorId_chaveIdempotencia_key" ON "PropostaPlanoRecuperacao"("preparadorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "PropostaPlanoRecuperacao" ADD CONSTRAINT "PropostaPlanoRecuperacao_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaPlanoRecuperacao" ADD CONSTRAINT "PropostaPlanoRecuperacao_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "AlocacaoTurma"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaPlanoRecuperacao" ADD CONSTRAINT "PropostaPlanoRecuperacao_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "Nivel"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaPlanoRecuperacao" ADD CONSTRAINT "PropostaPlanoRecuperacao_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "VersaoRegraAvaliacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaPlanoRecuperacao" ADD CONSTRAINT "PropostaPlanoRecuperacao_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_proposta_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE papeis_autor "Papel"[];
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Proposta de recuperação é imutável'; END IF;
 PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" AND status = 'ATIVA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta exige matrícula ativa'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id = a."turmaId" WHERE a.id = NEW."alocacaoId" AND a.ativa AND a."matriculaId" = NEW."matriculaId" AND t."nivelId" = NEW."nivelId" AND t."regraAvaliacaoId" = NEW."regraId") THEN RAISE EXCEPTION 'Vínculo, nível ou regra incompatível com a proposta'; END IF;
 SELECT papeis INTO papeis_autor FROM "Usuario" WHERE id = NEW."preparadorId" AND ativo FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Preparador inativo'; END IF;
 IF NOT (papeis_autor && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
  IF NOT ('PROFESSOR'::"Papel" = ANY(papeis_autor)) OR NOT EXISTS (
   SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id = a."turmaId" JOIN "VinculoDocente" v ON v."turmaId" = t.id AND v."professorId" = NEW."preparadorId"
   WHERE a.id = NEW."alocacaoId" AND t."professorId" = NEW."preparadorId" AND t.status <> 'CONCLUIDA' AND v.fim IS NULL AND v.inicio <= (clock_timestamp() AT TIME ZONE 'UTC')
  ) THEN RAISE EXCEPTION 'Preparador sem atribuição para o plano'; END IF;
 END IF;
 IF NEW.versao <> COALESCE((SELECT MAX(versao) FROM "PropostaPlanoRecuperacao" WHERE "matriculaId" = NEW."matriculaId" AND "nivelId" = NEW."nivelId"),0) + 1 THEN RAISE EXCEPTION 'Versão de plano desatualizada'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_proposta_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "PropostaPlanoRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_proposta_recuperacao();
