-- 214: destinações mantêm a autoria do fato de caixa; 211 aplicada permanece imutável.
BEGIN;
CREATE OR REPLACE FUNCTION "conferir_destinacao_recebimento_fin04_211"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "Recebimento"%ROWTYPE; c "Cobranca"%ROWTYPE; u "Usuario"%ROWTYPE; destinado numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Destinação de recebimento é imutável.'; END IF;
  IF NEW."origemLegada" THEN RAISE EXCEPTION 'Origem legada só pode ser criada pela migração.'; END IF;
  SELECT * INTO r FROM "Recebimento" WHERE id = NEW."recebimentoId" FOR UPDATE;
  IF r.id IS NULL OR NEW."autorId" IS DISTINCT FROM r."autorId" THEN
    RAISE EXCEPTION 'A destinação deve preservar a autoria do recebimento original.';
  END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF NOT FOUND OR r."titularMatriculaId" IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR' = ANY(u.papeis) OR 'FINANCEIRO' = ANY(u.papeis) OR 'pagamento.caixa' = ANY(u.permissoes)) THEN RAISE EXCEPTION 'Destinação exige recebimento com titular e autor de caixa vigente.'; END IF;
  IF NEW.evidencia IS NULL OR length(btrim(NEW.evidencia)) < 5 THEN RAISE EXCEPTION 'Destinação nova exige evidência identificada.'; END IF;
  IF NEW.tipo = 'COBRANCA' THEN
    SELECT * INTO c FROM "Cobranca" WHERE id = NEW."cobrancaId" FOR UPDATE;
    IF NOT FOUND OR c."matriculaId" IS DISTINCT FROM r."titularMatriculaId" OR c.moeda IS DISTINCT FROM r.moeda THEN RAISE EXCEPTION 'Destinação não pode trocar titular ou converter moeda.'; END IF;
  END IF;
  SELECT coalesce(sum(d.valor), 0) INTO destinado FROM "DestinacaoRecebimento" d WHERE d."recebimentoId" = NEW."recebimentoId";
  IF destinado + NEW.valor > r.valor THEN RAISE EXCEPTION 'Destinações excedem o valor do recebimento original.'; END IF;
  RETURN NEW;
END $$;

COMMIT;
