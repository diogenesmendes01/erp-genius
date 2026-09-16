-- M01/193: exigir complemento por campo sem modificar a migração 192 aplicada.
CREATE OR REPLACE FUNCTION conferir_fonte_conciliacao_financeira_migracao()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fonte jsonb; esperado jsonb; itens jsonb; item jsonb; campos text[] := ARRAY[]::text[];
  campo text; proposto text; valor_fonte text; tipo_cobranca text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (OLD.status='PENDENTE' AND NEW.status='APROVADA') THEN RETURN NEW; END IF;
  END IF;
  IF NEW.entrada->'complemento' IS DISTINCT FROM NEW.complemento
     OR NEW.entrada->>'linhaId' IS DISTINCT FROM NEW."linhaId"
     OR NEW.entrada->>'matriculaId' IS DISTINCT FROM NEW."matriculaId"
     OR NEW.entrada->>'cobrancaId' IS DISTINCT FROM NEW."cobrancaId"
     OR NEW.entrada->>'pagadorId' IS DISTINCT FROM NEW."pagadorId"
     OR NEW.entrada->>'modalidade' IS DISTINCT FROM NEW.modalidade::text
     OR NEW.entrada->>'moeda' IS DISTINCT FROM NEW.moeda
     OR NEW.entrada->>'forma' IS DISTINCT FROM NEW.forma::text
     OR NEW.entrada->>'recebimentoExistenteId' IS DISTINCT FROM NEW."recebimentoExistenteId"
     OR (NEW.entrada->>'valor')::numeric IS DISTINCT FROM NEW.valor
     OR (NEW.entrada->>'dataPagamento')::timestamptz IS DISTINCT FROM NEW."dataPagamento" THEN
    RAISE EXCEPTION 'Entrada auditada diverge da proposta financeira';
  END IF;
  IF NEW.modalidade='PENDENCIA' THEN
    IF NEW.complemento IS NOT NULL AND NEW.complemento <> 'null'::jsonb THEN
      RAISE EXCEPTION 'Pendência não admite complemento de pagamento';
    END IF;
    RETURN NEW;
  END IF;
  SELECT l."dadosOrigem"->'financeiro' INTO fonte
    FROM "LinhaPreparacaoMigracao" l WHERE l.id=NEW."linhaId" FOR SHARE;
  SELECT c.tipo::text INTO tipo_cobranca FROM "Cobranca" c WHERE c.id=NEW."cobrancaId" FOR SHARE;
  IF NEW.snapshot->'cobranca'->>'tipo' IS DISTINCT FROM tipo_cobranca THEN RAISE EXCEPTION 'Tipo da cobrança diverge da fotografia'; END IF;
  esperado := jsonb_build_object(
    'tipo',tipo_cobranca,'valor',NEW.valor::text,'moeda',NEW.moeda,
    'situacao','PAGAMENTO_COMPROVADO',
    'dataPagamento',NEW."dataPagamento",'forma',NEW.forma::text,'pagadorId',NEW."pagadorId");
  IF jsonb_typeof(NEW.complemento) IS DISTINCT FROM 'object'
     OR jsonb_typeof(NEW.complemento->'itens') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Pagamento histórico exige complemento estruturado';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(NEW.complemento) k WHERE k <> 'itens') THEN
    RAISE EXCEPTION 'Campo desconhecido no complemento financeiro';
  END IF;
  itens := NEW.complemento->'itens';
  IF jsonb_array_length(itens) NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'Complemento financeiro inválido'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(itens) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Item financeiro inválido'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('campo','valorProposto','motivo','evidencia')) THEN
      RAISE EXCEPTION 'Campo desconhecido no item financeiro';
    END IF;
    campo := item->>'campo';
    IF campo IS NULL OR NOT (esperado ? campo) OR campo=ANY(campos) THEN
      RAISE EXCEPTION 'Campo financeiro desconhecido ou repetido';
    END IF;
    campos := array_append(campos,campo);
    IF jsonb_typeof(item->'valorProposto') IS DISTINCT FROM 'string'
       OR jsonb_typeof(item->'motivo') IS DISTINCT FROM 'string'
       OR length(btrim(item->>'motivo')) NOT BETWEEN 10 AND 1000
       OR jsonb_typeof(item->'evidencia') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Complemento exige valor, motivo e evidência';
    END IF;
    IF item->'evidencia'='{}'::jsonb OR EXISTS (
      SELECT 1 FROM jsonb_each(item->'evidencia') e
      WHERE btrim(e.key)='' OR jsonb_typeof(e.value) NOT IN ('string','number','boolean')
        OR (jsonb_typeof(e.value)='string' AND btrim(e.value#>>'{}')='')
    ) THEN RAISE EXCEPTION 'Evidência financeira vazia ou inválida'; END IF;
    proposto := btrim(item->>'valorProposto');
    IF campo='valor' THEN
      IF proposto !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Valor complementar inválido'; END IF;
      IF proposto::numeric IS DISTINCT FROM NEW.valor THEN RAISE EXCEPTION 'Valor complementar divergente'; END IF;
    ELSIF campo='dataPagamento' THEN
      IF proposto !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'Data complementar exige fuso explícito'; END IF;
      IF proposto::timestamptz IS DISTINCT FROM NEW."dataPagamento" THEN RAISE EXCEPTION 'Data complementar divergente'; END IF;
    ELSIF proposto IS DISTINCT FROM esperado->>campo THEN
      RAISE EXCEPTION 'Complemento financeiro diverge do valor aplicado: %',campo;
    END IF;
  END LOOP;
  FOREACH campo IN ARRAY ARRAY['situacao','dataPagamento','forma','pagadorId'] LOOP
    IF NOT campo=ANY(campos) THEN RAISE EXCEPTION 'Complemento obrigatório ausente: %',campo; END IF;
  END LOOP;
  FOREACH campo IN ARRAY ARRAY['tipo','valor','moeda'] LOOP
    valor_fonte := btrim(fonte->>campo);
    IF campo='valor' THEN
      IF valor_fonte IS NULL OR valor_fonte !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN
        IF NOT campo=ANY(campos) THEN RAISE EXCEPTION 'Fonte exige complemento de valor'; END IF;
      ELSIF valor_fonte::numeric IS DISTINCT FROM NEW.valor AND NOT campo=ANY(campos) THEN
        RAISE EXCEPTION 'Divergência de valor exige complemento';
      END IF;
    ELSIF valor_fonte IS DISTINCT FROM esperado->>campo AND NOT campo=ANY(campos) THEN
      RAISE EXCEPTION 'Fonte exige complemento de %',campo;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER fonte_conciliacao_financeira_migracao_guard
BEFORE INSERT OR UPDATE ON "PropostaConciliacaoFinanceiraMigracao"
FOR EACH ROW EXECUTE FUNCTION conferir_fonte_conciliacao_financeira_migracao();
