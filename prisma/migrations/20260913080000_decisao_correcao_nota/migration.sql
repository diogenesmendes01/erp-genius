-- CreateTable
CREATE TABLE "DecisaoCorrecaoNota" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "impactos" JSONB NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoCorrecaoNota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoCorrecaoNota_propostaId_key" ON "DecisaoCorrecaoNota"("propostaId");

-- AddForeignKey
ALTER TABLE "DecisaoCorrecaoNota" ADD CONSTRAINT "DecisaoCorrecaoNota_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaCorrecaoNota"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DecisaoCorrecaoNota" ADD CONSTRAINT "DecisaoCorrecaoNota_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION preservar_proposta_correcao_nota() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v "VersaoLancamentoAvaliacao"%ROWTYPE; r "RegistroAvaliacaoMatricula"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Propostas de correção são imutáveis'; END IF;
 SELECT * INTO v FROM "VersaoLancamentoAvaliacao" WHERE id = NEW."lancamentoId";
 SELECT * INTO r FROM "RegistroAvaliacaoMatricula" WHERE id = v."registroId" FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM "DecisaoLancamentoAvaliacao" WHERE "lancamentoId" = v.id AND aprovada) THEN RAISE EXCEPTION 'Correção exige nota oficial'; END IF;
 IF NEW."origemHash" <> COALESCE((SELECT p."entradaHash" FROM "PropostaCorrecaoNota" p JOIN "DecisaoCorrecaoNota" d ON d."propostaId" = p.id AND d.aprovada WHERE p."lancamentoId" = v.id ORDER BY p.versao DESC LIMIT 1), v."conteudoHash") THEN RAISE EXCEPTION 'Confira a origem oficial da correção'; END IF;
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

CREATE FUNCTION preservar_decisao_correcao_nota() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaCorrecaoNota"%ROWTYPE; v "VersaoLancamentoAvaliacao"%ROWTYPE; origem TEXT;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisões de correção são imutáveis'; END IF;
 SELECT * INTO p FROM "PropostaCorrecaoNota" WHERE id = NEW."propostaId";
 SELECT * INTO v FROM "VersaoLancamentoAvaliacao" WHERE id = p."lancamentoId";
 PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id = v."registroId" FOR UPDATE;
 IF p."autorId" = NEW."decisorId" THEN RAISE EXCEPTION 'Correção exige outra pessoa'; END IF;
 PERFORM id FROM "Usuario" WHERE id = NEW."decisorId" AND ativo AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decisão exige gestão ativa'; END IF;
 IF NEW.aprovada THEN
  IF p.versao <> (SELECT MAX(versao) FROM "PropostaCorrecaoNota" WHERE "lancamentoId" = v.id) THEN RAISE EXCEPTION 'Existe proposta mais recente'; END IF;
  SELECT c."entradaHash" INTO origem FROM "PropostaCorrecaoNota" c JOIN "DecisaoCorrecaoNota" d ON d."propostaId" = c.id AND d.aprovada WHERE c."lancamentoId" = v.id ORDER BY c.versao DESC LIMIT 1;
  IF p."origemHash" <> COALESCE(origem, v."conteudoHash") THEN RAISE EXCEPTION 'Origem da correção desatualizada'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER preservar_decisao_correcao_nota BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoCorrecaoNota" FOR EACH ROW EXECUTE FUNCTION preservar_decisao_correcao_nota();
