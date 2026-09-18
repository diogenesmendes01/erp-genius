-- P02/222: defesa da fotografia financeira também no banco.
BEGIN;
CREATE FUNCTION conferir_fotografia_permuta_222() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta "PropostaCompensacaoPermuta"%ROWTYPE; destino record; cobranca "Cobranca"%ROWTYPE; foto jsonb;
BEGIN
 IF TG_TABLE_NAME='DestinoPropostaCompensacaoPermuta' THEN
  SELECT * INTO proposta FROM "PropostaCompensacaoPermuta" WHERE id=NEW."propostaId" FOR UPDATE;
  SELECT * INTO cobranca FROM "Cobranca" WHERE id=NEW."cobrancaId" FOR UPDATE;
  SELECT item INTO foto FROM jsonb_array_elements(proposta.snapshot->'destinos') item WHERE item->>'cobrancaId'=NEW."cobrancaId";
  IF foto IS NULL OR (foto->>'versao')::integer IS DISTINCT FROM cobranca.versao OR (foto->>'saldo')::numeric IS DISTINCT FROM cobranca.saldo OR (foto->>'valor')::numeric IS DISTINCT FROM NEW.valor OR cobranca.saldo IS NULL OR NEW.valor>cobranca.saldo OR cobranca."suspensaPorItemPausaId" IS NOT NULL OR cobranca."canceladaPorPausaId" IS NOT NULL OR EXISTS (SELECT 1 FROM "PagamentoInformado" WHERE "cobrancaId"=cobranca.id AND status='A_CONFERIR') THEN RAISE EXCEPTION 'Destino exige fotografia atual, saldo disponível e comprovantes conferidos'; END IF;
  RETURN NEW;
 END IF;
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT * INTO proposta FROM "PropostaCompensacaoPermuta" WHERE id=NEW."propostaId" FOR UPDATE;
 IF jsonb_typeof(proposta.snapshot->'destinos') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Proposta sem fotografia financeira verificável'; END IF;
 IF jsonb_array_length(proposta.snapshot->'destinos') IS DISTINCT FROM (SELECT count(*)::integer FROM "DestinoPropostaCompensacaoPermuta" WHERE "propostaId"=proposta.id) THEN RAISE EXCEPTION 'Fotografia não corresponde aos destinos'; END IF;
 FOR destino IN SELECT * FROM "DestinoPropostaCompensacaoPermuta" WHERE "propostaId"=proposta.id ORDER BY "cobrancaId" LOOP
  SELECT * INTO cobranca FROM "Cobranca" WHERE id=destino."cobrancaId" FOR UPDATE;
  SELECT item INTO foto FROM jsonb_array_elements(proposta.snapshot->'destinos') item WHERE item->>'cobrancaId'=destino."cobrancaId";
  IF foto IS NULL OR (SELECT count(*) FROM jsonb_array_elements(proposta.snapshot->'destinos') item WHERE item->>'cobrancaId'=destino."cobrancaId")<>1 OR (foto->>'versao')::integer IS DISTINCT FROM cobranca.versao OR (foto->>'saldo')::numeric IS DISTINCT FROM cobranca.saldo OR (foto->>'valor')::numeric IS DISTINCT FROM destino.valor OR cobranca.saldo IS NULL OR destino.valor>cobranca.saldo OR cobranca."suspensaPorItemPausaId" IS NOT NULL OR cobranca."canceladaPorPausaId" IS NOT NULL OR EXISTS (SELECT 1 FROM "PagamentoInformado" WHERE "cobrancaId"=cobranca.id AND status='A_CONFERIR') THEN RAISE EXCEPTION 'Proposta obsoleta: conferir novamente as mensalidades'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_fotografia_destino_permuta BEFORE INSERT ON "DestinoPropostaCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION conferir_fotografia_permuta_222();
CREATE TRIGGER conferir_fotografia_decisao_permuta BEFORE INSERT ON "DecisaoCompensacaoPermuta" FOR EACH ROW EXECUTE FUNCTION conferir_fotografia_permuta_222();
COMMIT;
