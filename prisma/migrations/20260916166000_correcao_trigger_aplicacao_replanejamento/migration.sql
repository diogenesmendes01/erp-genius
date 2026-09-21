CREATE OR REPLACE FUNCTION "validar_aplicacao_replanejamento_conjunto_162"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_decisao_rascunho TEXT; v_decisao_hash TEXT; v_aprovada BOOLEAN;
BEGIN
 SELECT d."rascunhoId", d."estadoHash", d.aprovada INTO v_decisao_rascunho, v_decisao_hash, v_aprovada FROM "DecisaoReplanejamentoConjunto" d WHERE d.id=NEW."decisaoId";
 IF NOT v_aprovada OR NEW."rascunhoId" IS DISTINCT FROM v_decisao_rascunho OR NEW."estadoHash" IS DISTINCT FROM v_decisao_hash THEN
   RAISE EXCEPTION 'Aplicação conjunta exige a decisão aprovada do mesmo rascunho e hash';
 END IF;
 RETURN NEW;
END $$;