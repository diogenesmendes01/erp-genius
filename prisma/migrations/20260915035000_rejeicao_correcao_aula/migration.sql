-- Q23: a rejeição é uma decisão independente e terminal para a proposta.
-- Ela não publica nem modifica o diário, os registros ou o encontro.

CREATE TABLE "RejeicaoCorrecaoAula" (
  "id" TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "propostaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

  CONSTRAINT "RejeicaoCorrecaoAula_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RejeicaoCorrecaoAula_propostaId_key" UNIQUE ("propostaId"),
  CONSTRAINT "RejeicaoCorrecaoAula_motivo_tamanho_check" CHECK (length(btrim("motivo")) BETWEEN 5 AND 3000),
  CONSTRAINT "RejeicaoCorrecaoAula_propostaHash_formato_check" CHECK ("propostaHash" ~ '^[a-f0-9]{64}$')
);

ALTER TABLE "RejeicaoCorrecaoAula"
  ADD CONSTRAINT "RejeicaoCorrecaoAula_propostaId_fkey"
    FOREIGN KEY ("propostaId") REFERENCES "PropostaCorrecaoAula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "RejeicaoCorrecaoAula_decisorId_fkey"
    FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION "validar_rejeicao_correcao_aula"()
RETURNS TRIGGER AS $$
DECLARE
  proposta_encontro_id TEXT;
  proposta_autor_id TEXT;
  proposta_versao INTEGER;
  proposta_entrada_hash TEXT;
  decisor_ativo BOOLEAN;
  decisor_papeis "Papel"[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Rejeições de correção de aula são imutáveis';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  SELECT proposta."encontroId", proposta."autorId", proposta.versao, proposta."entradaHash"
    INTO proposta_encontro_id, proposta_autor_id, proposta_versao, proposta_entrada_hash
    FROM "PropostaCorrecaoAula" proposta
    JOIN "EncontroAgenda" encontro ON encontro.id = proposta."encontroId"
    WHERE proposta.id = NEW."propostaId"
    FOR UPDATE OF proposta, encontro;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta de correção de aula não encontrada';
  END IF;

  IF NEW."propostaHash" IS DISTINCT FROM proposta_entrada_hash THEN
    RAISE EXCEPTION 'Hash da proposta de correção não confere';
  END IF;

  IF proposta_versao IS DISTINCT FROM (
    SELECT MAX(versao)
    FROM "PropostaCorrecaoAula"
    WHERE "encontroId" = proposta_encontro_id
  ) THEN
    RAISE EXCEPTION 'Somente a proposta mais recente da aula pode ser rejeitada';
  END IF;

  SELECT ativo, papeis INTO decisor_ativo, decisor_papeis
    FROM "Usuario"
    WHERE id = NEW."decisorId"
    FOR SHARE;
  IF NOT FOUND OR NOT decisor_ativo
    OR ('GERENTE_PEDAGOGICO'::"Papel" <> ALL(decisor_papeis)
      AND 'ADMINISTRADOR'::"Papel" <> ALL(decisor_papeis)) THEN
    RAISE EXCEPTION 'Rejeição exige gestor pedagógico ou administrador ativo';
  END IF;

  IF NEW."decisorId" IS NOT DISTINCT FROM proposta_autor_id THEN
    RAISE EXCEPTION 'Autor da proposta não pode rejeitá-la, mesmo com múltiplos papéis';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RejeicaoCorrecaoAula_validar"
  BEFORE INSERT OR UPDATE OR DELETE ON "RejeicaoCorrecaoAula"
  FOR EACH ROW EXECUTE FUNCTION "validar_rejeicao_correcao_aula"();
