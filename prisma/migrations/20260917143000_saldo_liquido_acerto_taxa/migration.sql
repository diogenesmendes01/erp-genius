-- DCT03/218 RASCUNHO: preserva crédito emitido e projeta a cobrança pela
-- liquidação líquida. As migrações 212--217 não são modificadas.
BEGIN;

CREATE OR REPLACE FUNCTION "dct03_saldo_liquido_taxa_218"(cobranca_id text, valor_novo numeric)
RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT greatest(0, valor_novo-coalesce(c."valorRecebido",0)-c."valorLiquidadoCredito"
   +coalesce((SELECT sum(o.valor) FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=c.id),0))
 FROM "Cobranca" c WHERE c.id=cobranca_id
$$;

-- Em vez de repetir a guarda 216, parte da definição instalada e troca só as
-- duas fórmulas. Todos os predicados de identidade, autoridade, condições,
-- versão, fotografia, segregação e transição continuam byte a byte iguais.
DO $$
DECLARE definicao text;
BEGIN
 SELECT pg_get_functiondef('dct03_acerto_taxa_guard'::regproc) INTO definicao;
 definicao := replace(definicao,
   'IF NEW."creditoAnterior" IS DISTINCT FROM credito_anterior OR credito_total < credito_anterior THEN RAISE EXCEPTION ''Aumento posterior exige conciliar crédito de taxa já originado''; END IF;',
   'IF NEW."creditoAnterior" IS DISTINCT FROM credito_anterior THEN RAISE EXCEPTION ''Crédito anterior não corresponde ao acerto''; END IF;');
 definicao := replace(definicao,
   'IF NEW."creditoNovo" IS DISTINCT FROM credito_total-credito_anterior THEN RAISE EXCEPTION ''Crédito novo não corresponde ao excedente ainda não originado''; END IF;',
   'IF NEW."creditoNovo" IS DISTINCT FROM greatest(0,credito_total-credito_anterior) THEN RAISE EXCEPTION ''Crédito novo não corresponde ao excedente ainda não originado''; END IF;');
 IF definicao NOT LIKE '%Crédito anterior não corresponde ao acerto%' THEN RAISE EXCEPTION '218 não encontrou a guarda 216 esperada'; END IF;
 EXECUTE definicao;
END $$;

DO $$
DECLARE definicao text;
BEGIN
 SELECT pg_get_functiondef('dct03_conferir_aplicacao_taxa_final'::regproc) INTO definicao;
 definicao := replace(definicao,
   'esperado_saldo := greatest(0,a."valorNovo"-coalesce(c."valorRecebido",0)-c."valorLiquidadoCredito");',
   'esperado_saldo := greatest(0,a."valorNovo"-coalesce(c."valorRecebido",0)-c."valorLiquidadoCredito"+credito_total);');
 IF definicao NOT LIKE '%+credito_total%' THEN RAISE EXCEPTION '218 não encontrou a finalização DCT03 esperada'; END IF;
 EXECUTE definicao;
END $$;

-- Q68/211 usam os mesmos campos de cobrança; preservam as próprias
-- destinações/usos e apenas acrescentam o crédito DCT03 emitido à projeção.
DO $$
DECLARE definicao text;
BEGIN
 SELECT pg_get_functiondef('proteger_saldo_credito_cobranca'::regproc) INTO definicao;
 definicao := replace(definicao,
   'greatest(0, NEW."valorNegociado" - coalesce(NEW."valorRecebido",0) - total)',
   'greatest(0, NEW."valorNegociado" - coalesce(NEW."valorRecebido",0) - total + coalesce((SELECT sum(o.valor) FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=NEW.id),0))');
 definicao := replace(definicao,
   'greatest(0, c."valorNegociado" - coalesce(c."valorRecebido",0) - novo_total)',
   'greatest(0, c."valorNegociado" - coalesce(c."valorRecebido",0) - novo_total + coalesce((SELECT sum(o.valor) FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=c.id),0))');
 EXECUTE definicao;
END $$;
DO $$
DECLARE definicao text;
BEGIN
 SELECT pg_get_functiondef('conferir_cobranca_destinacoes'::regproc) INTO definicao;
 definicao := replace(definicao,
   'greatest(0, NEW."valorNegociado" - total_recebido - total_credito)',
   'greatest(0, NEW."valorNegociado" - total_recebido - total_credito + coalesce((SELECT sum(o.valor) FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=NEW.id),0))');
 EXECUTE definicao;
END $$;
COMMIT;
