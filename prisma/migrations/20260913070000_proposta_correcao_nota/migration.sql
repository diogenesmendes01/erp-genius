-- CreateTable
CREATE TABLE "PropostaCorrecaoNota" (
    "id" TEXT NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "autorId" TEXT NOT NULL,
    "notas" JSONB NOT NULL,
    "origemHash" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaCorrecaoNota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCorrecaoNota_lancamentoId_versao_key" ON "PropostaCorrecaoNota"("lancamentoId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaCorrecaoNota_autorId_chaveIdempotencia_key" ON "PropostaCorrecaoNota"("autorId", "chaveIdempotencia");

-- AddForeignKey
ALTER TABLE "PropostaCorrecaoNota" ADD CONSTRAINT "PropostaCorrecaoNota_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "VersaoLancamentoAvaliacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PropostaCorrecaoNota" ADD CONSTRAINT "PropostaCorrecaoNota_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "PropostaCorrecaoNota" ADD CONSTRAINT proposta_correcao_versao_positiva CHECK (versao > 0);
CREATE FUNCTION preservar_proposta_correcao_nota() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v "VersaoLancamentoAvaliacao"%ROWTYPE; r "RegistroAvaliacaoMatricula"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Propostas de correção são imutáveis'; END IF;
 SELECT * INTO v FROM "VersaoLancamentoAvaliacao" WHERE id = NEW."lancamentoId";
 SELECT * INTO r FROM "RegistroAvaliacaoMatricula" WHERE id = v."registroId" FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "DecisaoLancamentoAvaliacao" WHERE "lancamentoId" = v.id AND aprovada) THEN RAISE EXCEPTION 'Correção exige nota oficial'; END IF;
 IF NEW."origemHash" <> v."conteudoHash" THEN RAISE EXCEPTION 'Confira a origem oficial da correção'; END IF;
 SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
 IF NOT u.ativo OR NOT (u.papeis && ARRAY['PROFESSOR','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Autor sem permissão de correção'; END IF;
 IF NOT (u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) AND NOT EXISTS (
  SELECT 1 FROM "Turma" t JOIN "VinculoDocente" d ON d."turmaId" = t.id
  WHERE t.id = r."turmaId" AND t."professorId" = u.id AND t.status <> 'CONCLUIDA' AND d."professorId" = u.id AND d.fim IS NULL AND d.inicio <= clock_timestamp()
 ) THEN RAISE EXCEPTION 'Professor sem atribuição vigente'; END IF;
 IF NEW.versao <> COALESCE((SELECT MAX(versao) FROM "PropostaCorrecaoNota" WHERE "lancamentoId" = v.id), 0) + 1 THEN RAISE EXCEPTION 'Versão de correção desatualizada'; END IF;
 IF jsonb_typeof(NEW.notas) <> 'array' OR jsonb_array_length(NEW.notas) <> jsonb_array_length(v.notas) OR
  EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.notas) n WHERE n->'nota' IS NULL OR n->'nota' = 'null'::jsonb) THEN
  RAISE EXCEPTION 'Correção exige notas completas';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_proposta_correcao_nota BEFORE INSERT OR UPDATE OR DELETE ON "PropostaCorrecaoNota" FOR EACH ROW EXECUTE FUNCTION preservar_proposta_correcao_nota();
