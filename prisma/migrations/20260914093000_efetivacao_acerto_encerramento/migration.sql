CREATE TABLE "EfetivacaoAcertoEncerramento" (
 id TEXT PRIMARY KEY,"solicitacaoId" TEXT NOT NULL REFERENCES "SolicitacaoEncerramentoMatriculas"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "decisaoId" TEXT NOT NULL REFERENCES "DecisaoAcertoEncerramento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "executorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, resultado JSONB NOT NULL
);
CREATE UNIQUE INDEX "EfetivacaoAcertoEncerramento_solicitacaoId_key" ON "EfetivacaoAcertoEncerramento"("solicitacaoId");
CREATE UNIQUE INDEX "EfetivacaoAcertoEncerramento_decisaoId_key" ON "EfetivacaoAcertoEncerramento"("decisaoId");
CREATE TRIGGER efetivacao_acerto_preservada BEFORE UPDATE OR DELETE ON "EfetivacaoAcertoEncerramento" FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_efetivacao_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "RascunhoAcertoEncerramento"; aprovado BOOLEAN; p JSONB; item JSONB;
BEGIN
 SELECT d.aprovada INTO aprovado FROM "DecisaoAcertoEncerramento" d WHERE d.id=NEW."decisaoId";
 SELECT ra.* INTO r FROM "RascunhoAcertoEncerramento" ra JOIN "DecisaoAcertoEncerramento" d ON d."rascunhoId"=ra.id WHERE d.id=NEW."decisaoId";
 IF aprovado IS DISTINCT FROM true OR r."solicitacaoId" IS DISTINCT FROM NEW."solicitacaoId"
 OR NOT EXISTS (SELECT 1 FROM "Usuario" WHERE id=NEW."executorId" AND ativo AND papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[])
 THEN RAISE EXCEPTION 'Efetivação exige decisão e executor financeiro válidos'; END IF;
 IF EXISTS (SELECT 1 FROM "ItemSolicitacaoEncerramento" i JOIN "Matricula" m ON m.id=i."matriculaId" WHERE i."solicitacaoId"=NEW."solicitacaoId" AND (m.status::text<>'ENCERRADA' OR NOT EXISTS (SELECT 1 FROM "RegistroEncerramentoMatricula" re WHERE re."matriculaId"=m.id AND re."decisaoId"=NEW."decisaoId"))) THEN RAISE EXCEPTION 'Conclua as matrículas selecionadas na mesma transação'; END IF;
 FOR p IN SELECT c->'lancamentos'->'plano' FROM jsonb_array_elements(r.snapshot->'contratos') c LOOP
  IF p IS NULL OR p='null'::jsonb THEN RAISE EXCEPTION 'Plano ausente'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p->'ajustes') LOOP
   IF NOT EXISTS (SELECT 1 FROM "AjusteCobrancaAcerto" WHERE "decisaoId"=NEW."decisaoId" AND "cobrancaId"=item->>'cobrancaId') THEN RAISE EXCEPTION 'Ajuste pendente na efetivação'; END IF;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(p->'creditos') LOOP
   IF NOT EXISTS (SELECT 1 FROM "OrigemCreditoAcerto" o JOIN "CreditoMatricula" cr ON cr."origemAcertoId"=o.id WHERE o."decisaoId"=NEW."decisaoId" AND o."origemTipo"=item->>'origemTipo' AND o."origemId"=item->>'origemId') THEN RAISE EXCEPTION 'Crédito pendente na efetivação'; END IF;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(p->'horasALiquidar') LOOP
   IF NOT EXISTS (SELECT 1 FROM "LiquidacaoHorasAcerto" WHERE "decisaoId"=NEW."decisaoId" AND "compraId"=item->>'compraId') THEN RAISE EXCEPTION 'Horas pendentes na efetivação'; END IF;
  END LOOP;
  IF (p->'multa'->>'valorProposto')::numeric>0 AND NOT EXISTS (SELECT 1 FROM "Cobranca" WHERE "acertoMultaDecisaoId"=NEW."decisaoId" AND "matriculaId"=p->>'matriculaId') THEN RAISE EXCEPTION 'Multa pendente na efetivação'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER efetivacao_acerto_conferida BEFORE INSERT ON "EfetivacaoAcertoEncerramento" FOR EACH ROW EXECUTE FUNCTION conferir_efetivacao_acerto();
CREATE FUNCTION concluir_pedido_encerramento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "SolicitacaoEncerramentoMatriculas" SET status='CONCLUIDA' WHERE id=NEW."solicitacaoId";
 RETURN NEW;
END $$;
CREATE TRIGGER efetivacao_acerto_concluida AFTER INSERT ON "EfetivacaoAcertoEncerramento" FOR EACH ROW EXECUTE FUNCTION concluir_pedido_encerramento();
