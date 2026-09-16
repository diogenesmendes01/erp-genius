CREATE TABLE "DestinacaoDiaAcerto" (
 id TEXT PRIMARY KEY, "diaId" TEXT NOT NULL REFERENCES "DiaCompensacaoCobertura"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "decisaoId" TEXT NOT NULL REFERENCES "DecisaoAcertoEncerramento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 tratamento TEXT NOT NULL CHECK(tratamento IN ('COMPENSACAO','PROPORCIONAL')),
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DestinacaoDiaAcerto_diaId_key" ON "DestinacaoDiaAcerto"("diaId");
CREATE TRIGGER destinacao_acerto_preservada BEFORE UPDATE OR DELETE ON "DestinacaoDiaAcerto" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_destinacao_dia_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE dia "DiaCompensacaoCobertura"; comp "CompensacaoCoberturaMatricula"; plano JSONB; ajuste JSONB; lista JSONB;
BEGIN
 SELECT * INTO dia FROM "DiaCompensacaoCobertura" WHERE id=NEW."diaId" FOR UPDATE;
 SELECT * INTO comp FROM "CompensacaoCoberturaMatricula" WHERE id=dia."compensacaoId";
 IF dia.estado <> 'PENDENTE' OR comp.status <> 'APROVADA' THEN RAISE EXCEPTION 'Dia já destinado ou compensação não aprovada'; END IF;
 SELECT c->'lancamentos'->'plano' INTO plano FROM "DecisaoAcertoEncerramento" d JOIN "RascunhoAcertoEncerramento" r ON r.id=d."rascunhoId", jsonb_array_elements(r.snapshot->'contratos') c
 WHERE d.id=NEW."decisaoId" AND d.aprovada AND c->'lancamentos'->'plano'->>'matriculaId'=dia."matriculaId";
 SELECT a INTO ajuste FROM jsonb_array_elements(plano->'compensacoes') a WHERE a->>'cobrancaId'=comp."cobrancaOrigemId" AND a->'compensacaoIds' ? comp.id;
 lista := CASE WHEN NEW.tratamento='COMPENSACAO' THEN ajuste->'apuracao'->'diasPendentes' ELSE ajuste->'apuracao'->'origem'->'diasContempladosNoProporcional' END;
 IF coalesce(lista ? to_char(dia."diaOrigem",'YYYY-MM-DD'),false) IS NOT TRUE THEN RAISE EXCEPTION 'Dia ou tratamento não corresponde ao acerto aprovado'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "AjusteCobrancaAcerto" WHERE "decisaoId"=NEW."decisaoId" AND "cobrancaId"=comp."cobrancaOrigemId") THEN RAISE EXCEPTION 'Destinação exige ajuste da cobrança na mesma decisão'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER destinacao_dia_acerto_conferida BEFORE INSERT ON "DestinacaoDiaAcerto" FOR EACH ROW EXECUTE FUNCTION conferir_destinacao_dia_acerto();
CREATE FUNCTION aplicar_destinacao_dia_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "DiaCompensacaoCobertura" SET estado='LIQUIDADO_FINANCEIRAMENTE', "destinacaoReferencia"=NEW.id,"destinadoEm"=NEW."criadoEm", versao=versao+1 WHERE id=NEW."diaId";
 RETURN NEW;
END $$;
CREATE TRIGGER destinacao_dia_acerto_aplicada AFTER INSERT ON "DestinacaoDiaAcerto" FOR EACH ROW EXECUTE FUNCTION aplicar_destinacao_dia_acerto();
