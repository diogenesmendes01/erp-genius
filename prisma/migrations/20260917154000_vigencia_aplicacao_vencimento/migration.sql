-- 229: preparar/aprovar não antecipa a vigência financeira do aditivo.
CREATE FUNCTION conferir_vigencia_vencimento_229() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE vigencia TIMESTAMP;
BEGIN
 SELECT v."vigenciaInicio" INTO vigencia FROM "DecisaoVencimentoAditivo" d
 JOIN "PropostaVencimentoAditivo" p ON p.id=d."propostaId"
 JOIN "VersaoCondicoesAditivo" v ON v.id=p."versaoCondicoesId" WHERE d.id=NEW."decisaoId";
 IF vigencia IS NULL OR vigencia > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
 THEN RAISE EXCEPTION 'Aguarde a vigência aprovada antes de aplicar o vencimento'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conferir_vigencia_vencimento_229 BEFORE INSERT ON "AplicacaoVencimentoAditivo"
 FOR EACH ROW EXECUTE FUNCTION conferir_vigencia_vencimento_229();
