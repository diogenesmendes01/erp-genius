CREATE TABLE "LiquidacaoHorasAcerto" (
 id TEXT PRIMARY KEY,
 "compraId" TEXT NOT NULL REFERENCES "CompraHorasAntecipadas"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "decisaoId" TEXT NOT NULL REFERENCES "DecisaoAcertoEncerramento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 minutos INTEGER NOT NULL CHECK(minutos > 0), valor DECIMAL(12,2) NOT NULL CHECK(valor >= 0),
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "LiquidacaoHorasAcerto_compraId_key" ON "LiquidacaoHorasAcerto"("compraId");
CREATE TRIGGER liquidacao_horas_preservada BEFORE UPDATE OR DELETE ON "LiquidacaoHorasAcerto" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_liquidacao_horas_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "CompraHorasAntecipadas"; s JSONB; consumidos BIGINT; liquidados BIGINT; anterior NUMERIC; pendentes BIGINT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO c FROM "CompraHorasAntecipadas" WHERE id=NEW."compraId" FOR UPDATE;
 SELECT r.snapshot INTO s FROM "DecisaoAcertoEncerramento" d JOIN "RascunhoAcertoEncerramento" r ON r.id=d."rascunhoId" WHERE d.id=NEW."decisaoId" AND d.aprovada;
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s->'contratos') ct, jsonb_array_elements(ct->'lancamentos'->'plano'->'horasALiquidar') h
  WHERE ct->'lancamentos'->'plano'->>'matriculaId'=c."matriculaId" AND ct->'lancamentos'->'plano'->>'moeda'=c.moeda
  AND h->>'compraId'=c.id AND (h->>'minutos')::integer=NEW.minutos AND (h->>'valor')::numeric=NEW.valor)
 THEN RAISE EXCEPTION 'Liquidação de horas diverge do plano aprovado'; END IF;
 SELECT coalesce(sum(r.minutos),0) INTO consumidos FROM "ReservaHorasCompradas" r JOIN "ConsumoHorasCompradas" co ON co."reservaId"=r.id WHERE r."compraId"=c.id;
 SELECT coalesce(sum(r.minutos),0), coalesce(sum(cr."valorInicial"),0) INTO liquidados, anterior
 FROM "ReservaHorasCompradas" r JOIN "DecisaoLiberacaoHoras" d ON d."reservaId"=r.id AND d.aprovada
 JOIN "PropostaLiberacaoHoras" p ON p.id=d."propostaId" AND p.destino='CREDITO'
 JOIN "CreditoMatricula" cr ON cr."origemLiberacaoId"=d.id WHERE r."compraId"=c.id;
 SELECT count(*) INTO pendentes FROM "ReservaHorasCompradas" r WHERE r."compraId"=c.id
 AND NOT EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" co WHERE co."reservaId"=r.id)
 AND NOT EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" d WHERE d."reservaId"=r.id AND d.aprovada);
 IF pendentes > 0 OR NEW.minutos <> c."minutosComprados"-consumidos-liquidados
 OR NEW.valor <> round(c."valorPagoAlocado"*(c."minutosComprados"-consumidos)/c."minutosComprados",2)-anterior
 THEN RAISE EXCEPTION 'Saldo de horas mudou ou possui reservas pendentes'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER liquidacao_horas_conferida BEFORE INSERT ON "LiquidacaoHorasAcerto" FOR EACH ROW EXECUTE FUNCTION conferir_liquidacao_horas_acerto();
CREATE FUNCTION impedir_reserva_compra_liquidada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM id FROM "CompraHorasAntecipadas" WHERE id=NEW."compraId" FOR UPDATE;
 IF EXISTS (SELECT 1 FROM "LiquidacaoHorasAcerto" WHERE "compraId"=NEW."compraId") THEN RAISE EXCEPTION 'Compra liquidada no encerramento não permite nova reserva'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER impedir_reserva_compra_liquidada BEFORE INSERT ON "ReservaHorasCompradas" FOR EACH ROW EXECUTE FUNCTION impedir_reserva_compra_liquidada();
CREATE FUNCTION exigir_credito_liquidacao_horas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.valor > 0 AND NOT EXISTS (SELECT 1 FROM "OrigemCreditoAcerto" o JOIN "CreditoMatricula" cr ON cr."origemAcertoId"=o.id
 WHERE o."origemTipo"='COMPRA_HORAS' AND o."origemId"=NEW."compraId" AND o."decisaoId"=NEW."decisaoId" AND o.valor=NEW.valor)
 THEN RAISE EXCEPTION 'Liquidação positiva exige crédito na mesma transação'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER exigir_credito_liquidacao_horas AFTER INSERT ON "LiquidacaoHorasAcerto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION exigir_credito_liquidacao_horas();
CREATE FUNCTION exigir_liquidacao_origem_horas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."origemTipo"='COMPRA_HORAS' AND NOT EXISTS (SELECT 1 FROM "LiquidacaoHorasAcerto" WHERE "compraId"=NEW."origemId" AND "decisaoId"=NEW."decisaoId" AND valor=NEW.valor)
 THEN RAISE EXCEPTION 'Crédito de horas exige liquidação na mesma transação'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER exigir_liquidacao_origem_horas AFTER INSERT ON "OrigemCreditoAcerto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION exigir_liquidacao_origem_horas();
