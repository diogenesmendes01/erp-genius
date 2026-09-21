-- Corretiva da migração 232: colunas @db.Date não devem ser convertidas pelo
-- fuso da sessão antes de comparar a fotografia canônica YYYY-MM-DD.
CREATE OR REPLACE FUNCTION conferir_linhas_conjunto_impactos_taxa_232(conjunto_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE conjunto "ConjuntoImpactosTaxaAditivo"%ROWTYPE; total_taxas integer; total_linhas integer;
BEGIN
  SELECT * INTO conjunto FROM "ConjuntoImpactosTaxaAditivo" WHERE id=conjunto_id FOR SHARE;
  IF conjunto.id IS NULL THEN RAISE EXCEPTION 'Conjunto de impactos indisponível'; END IF;
  SELECT count(*) INTO total_taxas FROM "Cobranca" WHERE "matriculaId"=conjunto."matriculaId" AND tipo='MATRICULA';
  SELECT count(*) INTO total_linhas FROM "ImpactoTaxaAditivo" WHERE "conjuntoId"=conjunto.id;
  IF total_linhas <> total_taxas THEN RAISE EXCEPTION 'O conjunto deve declarar todas as taxas existentes da matrícula' USING ERRCODE='Q2321'; END IF;
  IF EXISTS (
    SELECT 1 FROM "ImpactoTaxaAditivo" i
    JOIN "Cobranca" c ON c.id=i."cobrancaId"
    LEFT JOIN "PropostaAcertoTaxaAditivo" p ON p.id=i."propostaAcertoId"
    LEFT JOIN "AplicacaoAcertoTaxaAditivo" a ON a."propostaId"=p.id
    WHERE i."conjuntoId"=conjunto.id
      AND (
        i.fotografia->'cobranca'->>'versao' IS DISTINCT FROM c.versao::text
        OR (i.fotografia->'cobranca'->>'valorNegociado')::numeric IS DISTINCT FROM c."valorNegociado"::numeric
        OR i.fotografia->'cobranca'->>'vencimento' IS DISTINCT FROM to_char(c.vencimento::date,'YYYY-MM-DD')
        OR i.fotografia->'cobranca'->>'status' IS DISTINCT FROM c.status::text
        OR (i.fotografia->'cobranca'->>'valorRecebido')::numeric IS DISTINCT FROM c."valorRecebido"::numeric
        OR (i.fotografia->'cobranca'->>'valorLiquidadoCredito')::numeric IS DISTINCT FROM c."valorLiquidadoCredito"::numeric
        OR (i.fotografia->'cobranca'->>'saldo')::numeric IS DISTINCT FROM c.saldo::numeric
      )
      AND NOT (
        p.status='APLICADA' AND a.id IS NOT NULL AND c.versao=a."versaoAnterior"+1
        AND c."valorNegociado"::numeric=a."valorNovo"::numeric
        AND to_char(c.vencimento::date,'YYYY-MM-DD')=to_char(a."vencimentoNovo"::date,'YYYY-MM-DD')
      )
  ) THEN RAISE EXCEPTION 'A fotografia de taxa mudou e exige reconstrução do conjunto' USING ERRCODE='Q2321'; END IF;
END;
$$;
