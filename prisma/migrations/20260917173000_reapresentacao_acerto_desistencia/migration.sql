-- Q165: propostas rejeitadas podem ser reapresentadas como uma cadeia auditável.
-- A nova versão nunca altera a memória, a decisão nem a fotografia da anterior.
BEGIN;

ALTER TABLE "PropostaAcertoDesistenciaContratual"
  ADD COLUMN "anteriorId" TEXT,
  ADD COLUMN versao INTEGER,
  ADD COLUMN "motivoReapresentacao" TEXT;

ALTER TABLE "PropostaAcertoDesistenciaContratual" DISABLE TRIGGER "PropostaAcertoDesistenciaContratual_imutavel";

WITH ordenadas AS (
  SELECT id, row_number() OVER (PARTITION BY "pedidoId" ORDER BY "criadaEm", id)::INTEGER AS versao
  FROM "PropostaAcertoDesistenciaContratual"
)
UPDATE "PropostaAcertoDesistenciaContratual" proposta
SET versao=ordenadas.versao
FROM ordenadas
WHERE proposta.id=ordenadas.id;

ALTER TABLE "PropostaAcertoDesistenciaContratual" ENABLE TRIGGER "PropostaAcertoDesistenciaContratual_imutavel";

ALTER TABLE "PropostaAcertoDesistenciaContratual"
  ALTER COLUMN versao SET NOT NULL,
  ADD CONSTRAINT "PropostaAcertoDesistenciaContratual_versao_check" CHECK (versao>0),
  ADD CONSTRAINT "PropostaAcertoDesistenciaContratual_motivoReapresentacao_check" CHECK ("motivoReapresentacao" IS NULL OR length(btrim("motivoReapresentacao")) BETWEEN 5 AND 3000),
  ADD CONSTRAINT "PropostaAcertoDesistenciaContratual_anteriorId_fkey" FOREIGN KEY ("anteriorId") REFERENCES "PropostaAcertoDesistenciaContratual"(id) ON DELETE RESTRICT,
  DROP CONSTRAINT "PropostaAcertoDesistenciaCont_pedidoId_condicoesId_fotograf_key",
  ADD CONSTRAINT "PropostaAcertoDesistenciaContratual_pedidoId_versao_key" UNIQUE ("pedidoId", versao);
CREATE INDEX "PropostaAcertoDesistenciaContratual_anteriorId_idx" ON "PropostaAcertoDesistenciaContratual"("anteriorId");

CREATE OR REPLACE FUNCTION q165_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  p "PropostaAcertoDesistenciaContratual"%ROWTYPE;
  anterior "PropostaAcertoDesistenciaContratual"%ROWTYPE;
  d "DecisaoAcertoDesistenciaContratual"%ROWTYPE;
  regras JSONB;
  pe "PedidoDesistenciaPreparacao"%ROWTYPE;
  da "DecisaoAdministrativaDesistencia"%ROWTYPE;
  u RECORD;
BEGIN
 IF TG_TABLE_NAME='PropostaAcertoDesistenciaContratual' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta é imutável'; END IF;
  SELECT c.regras INTO regras FROM "CondicoesEncerramentoMatricula" c WHERE c.id=NEW."condicoesId" FOR SHARE;
  IF NEW."condicoesHash" IS DISTINCT FROM encode(digest(q165_json_canon(regras),'sha256'),'hex') OR NEW."fotografiaHash" IS DISTINCT FROM encode(digest(q165_json_canon(NEW.memoria->'fotografia'),'sha256'),'hex')
    OR NEW.memoria->>'anteriorId' IS DISTINCT FROM NEW."anteriorId" OR NEW.memoria->>'motivoReapresentacao' IS DISTINCT FROM NEW."motivoReapresentacao" THEN
    RAISE EXCEPTION 'Hashes ou cadeia Q165 não comprovam a memória canônica';
  END IF;
  PERFORM q165_autorizado(NEW."preparadorId",false);
  -- q165_contexto bloqueia pedido e matrícula; a cadeia é então observada após
  -- esse lock, impedindo duas reapresentações para a mesma rejeição.
  PERFORM q165_contexto(NEW.id);
  PERFORM id FROM "PropostaAcertoDesistenciaContratual" x WHERE x."pedidoId"=NEW."pedidoId" AND x.id<>NEW.id ORDER BY x.versao FOR UPDATE;
  IF NEW."anteriorId" IS NULL THEN
    IF NEW.versao<>1 OR NEW."motivoReapresentacao" IS NOT NULL OR EXISTS(SELECT 1 FROM "PropostaAcertoDesistenciaContratual" x WHERE x."pedidoId"=NEW."pedidoId" AND x.id<>NEW.id) THEN
      RAISE EXCEPTION 'A primeira proposta Q165 deve iniciar a cadeia sem reapresentação';
    END IF;
  ELSE
    SELECT * INTO anterior FROM "PropostaAcertoDesistenciaContratual" WHERE id=NEW."anteriorId" FOR UPDATE;
    IF anterior.id IS NULL OR anterior."pedidoId" IS DISTINCT FROM NEW."pedidoId" OR NEW.versao<>anterior.versao+1
      OR NEW."motivoReapresentacao" IS NULL OR length(btrim(NEW."motivoReapresentacao")) NOT BETWEEN 5 AND 3000
      OR NOT EXISTS(SELECT 1 FROM "DecisaoAcertoDesistenciaContratual" decisao WHERE decisao."propostaId"=anterior.id AND (NOT decisao.aprovada OR (decisao.aprovada AND NOT EXISTS(SELECT 1 FROM "AplicacaoAcertoDesistenciaContratual" aplicacao WHERE aplicacao."decisaoId"=decisao.id) AND (anterior."fotografiaHash" IS DISTINCT FROM NEW."fotografiaHash" OR anterior."condicoesHash" IS DISTINCT FROM NEW."condicoesHash"))))
      OR EXISTS(SELECT 1 FROM "PropostaAcertoDesistenciaContratual" x WHERE x."pedidoId"=NEW."pedidoId" AND x.id<>NEW.id AND x.versao>anterior.versao) THEN
      RAISE EXCEPTION 'Reapresentação exige a última proposta rejeitada ou uma aprovada tornada materialmente obsoleta';
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM "AplicacaoAcertoDesistenciaContratual" a JOIN "DecisaoAcertoDesistenciaContratual" x ON x.id=a."decisaoId" JOIN "PropostaAcertoDesistenciaContratual" proposta_anterior ON proposta_anterior.id=x."propostaId" WHERE proposta_anterior."pedidoId"=NEW."pedidoId") THEN RAISE EXCEPTION 'Este pedido já possui aplicação Q165 pendente de efetivação.'; END IF;
  PERFORM q165_memoria(NEW.id); RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='DecisaoAcertoDesistenciaContratual' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Decisão é imutável'; END IF;
  SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=NEW."propostaId" FOR UPDATE;
  IF p.id IS NULL OR p."preparadorId"=NEW."decisorId" OR NEW."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash"
    OR EXISTS(SELECT 1 FROM "PropostaAcertoDesistenciaContratual" x WHERE x."pedidoId"=p."pedidoId" AND x.versao>p.versao) THEN RAISE EXCEPTION 'Decisão não corresponde à última proposta independente'; END IF;
  PERFORM q165_autorizado(NEW."decisorId",true); IF NEW.aprovada THEN PERFORM q165_contexto(p.id); PERFORM q165_memoria(p.id); END IF; RETURN NEW;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Aplicação é imutável'; END IF;
 SELECT * INTO d FROM "DecisaoAcertoDesistenciaContratual" WHERE id=NEW."decisaoId" FOR SHARE;
 SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=d."propostaId" FOR UPDATE;
 SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR SHARE;
 SELECT * INTO da FROM "DecisaoAdministrativaDesistencia" WHERE "pedidoId"=pe.id FOR SHARE;
 SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=da."decisorId" FOR SHARE;
 IF d.id IS NULL OR p.id IS NULL OR NOT d.aprovada OR NEW."executorId" IS DISTINCT FROM d."decisorId" OR NEW."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR NEW."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR NEW.memoria IS DISTINCT FROM p.memoria OR da.id IS NULL OR NOT da.aprovada OR da."estadoHash" IS DISTINCT FROM p."estadoHash" OR da."decisorId"=pe."registradorId" OR u.ativo IS NOT TRUE OR NOT ('ADMINISTRADOR'=ANY(u.papeis)) OR EXISTS(SELECT 1 FROM "PropostaAcertoDesistenciaContratual" x WHERE x."pedidoId"=p."pedidoId" AND x.versao>p.versao) THEN RAISE EXCEPTION 'Aplicação Q165 exige a última proposta, decisões financeira e administrativa aprovadas e independentes'; END IF;
 PERFORM q165_autorizado(NEW."executorId",true); PERFORM q165_contexto(p.id);
 IF EXISTS(SELECT 1 FROM "AplicacaoAcertoDesistenciaContratual" a JOIN "DecisaoAcertoDesistenciaContratual" x ON x.id=a."decisaoId" JOIN "PropostaAcertoDesistenciaContratual" proposta_anterior ON proposta_anterior.id=x."propostaId" WHERE proposta_anterior."pedidoId"=p."pedidoId") THEN RAISE EXCEPTION 'Este pedido já possui aplicação Q165 pendente de efetivação.'; END IF;
 PERFORM q165_memoria(p.id); RETURN NEW;
END $$;

COMMIT;
