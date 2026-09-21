-- CreateTable
CREATE TABLE "DecisaoPlanoRecuperacao" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoPlanoRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoPlanoRecuperacao_propostaId_key" ON "DecisaoPlanoRecuperacao"("propostaId");

-- AddForeignKey
ALTER TABLE "DecisaoPlanoRecuperacao" ADD CONSTRAINT "DecisaoPlanoRecuperacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaPlanoRecuperacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoPlanoRecuperacao" ADD CONSTRAINT "DecisaoPlanoRecuperacao_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION preservar_decisao_plano_recuperacao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaPlanoRecuperacao"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão de recuperação é imutável'; END IF;
 SELECT * INTO p FROM "PropostaPlanoRecuperacao" WHERE id = NEW."propostaId";
 PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
 IF p."preparadorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Decisão exige outra pessoa'; END IF;
 PERFORM id FROM "Usuario" WHERE id = NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige gestão ativa'; END IF;
 IF NEW.aprovada THEN
  IF p.versao <> (SELECT MAX(versao) FROM "PropostaPlanoRecuperacao" WHERE "matriculaId" = p."matriculaId" AND "nivelId" = p."nivelId") THEN RAISE EXCEPTION 'Existe proposta de recuperação mais recente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Matricula" WHERE id = p."matriculaId" AND status = 'ATIVA') THEN RAISE EXCEPTION 'Matrícula exige conferência de autorização específica'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "AlocacaoTurma" a JOIN "Turma" t ON t.id = a."turmaId" WHERE a.id = p."alocacaoId" AND a.ativa AND a."matriculaId" = p."matriculaId" AND t."nivelId" = p."nivelId" AND t."regraAvaliacaoId" = p."regraId") THEN RAISE EXCEPTION 'Vínculo do plano mudou'; END IF;
 END IF;
 IF COALESCE(length(btrim(NEW.motivo)),0) < 5 THEN RAISE EXCEPTION 'Justifique a decisão'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_decisao_plano_recuperacao BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoPlanoRecuperacao" FOR EACH ROW EXECUTE FUNCTION preservar_decisao_plano_recuperacao();
