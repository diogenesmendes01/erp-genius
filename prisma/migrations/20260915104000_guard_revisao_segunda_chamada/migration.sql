-- Uma revisão vinculada à mesma realização só sucede uma devolução explícita.
CREATE FUNCTION guardar_revisao_nota_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ultima record;
BEGIN
 IF NEW."segundaChamadaRealizacaoId" IS NULL THEN RETURN NEW; END IF;
 PERFORM id FROM "RegistroAvaliacaoMatricula" WHERE id=NEW."registroId" FOR UPDATE;
 PERFORM id FROM "RealizacaoSegundaChamada" WHERE id=NEW."segundaChamadaRealizacaoId" FOR KEY SHARE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT l.id,d.aprovada INTO ultima
   FROM "VersaoLancamentoAvaliacao" l
   LEFT JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId"=l.id
   WHERE l."segundaChamadaRealizacaoId"=NEW."segundaChamadaRealizacaoId"
   ORDER BY l.versao DESC LIMIT 1 FOR UPDATE OF l;
 IF FOUND AND ultima.aprovada IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'Nova versão da nota de segunda chamada exige rejeição da versão anterior';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER trg_guard_revisao_nota_segunda_chamada
BEFORE INSERT ON "VersaoLancamentoAvaliacao"
FOR EACH ROW EXECUTE FUNCTION guardar_revisao_nota_segunda_chamada();
