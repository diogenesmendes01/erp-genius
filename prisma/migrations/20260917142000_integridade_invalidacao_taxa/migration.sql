-- DCT03/217: a invalidação registra a fotografia material EXATA da versão
-- formalizada mais recente da matrícula. 212--216 já foram aplicadas e não
-- são reescritas: esta migração substitui as funções que seus triggers usam.
BEGIN;

CREATE OR REPLACE FUNCTION "dct03_fotografia_invalidacao_canonica_217"(foto jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE c jsonb; calc jsonb; itens text;
BEGIN
  IF jsonb_typeof(foto) <> 'object'
    OR NOT (foto ?& ARRAY['revisaoHash','condicoesHash','versaoCondicoesId','cobranca','calculo','comissoes'])
    OR (foto - 'revisaoHash' - 'condicoesHash' - 'versaoCondicoesId' - 'cobranca' - 'calculo' - 'comissoes') <> '{}'::jsonb
    OR jsonb_typeof(foto->'revisaoHash') <> 'string'
    OR jsonb_typeof(foto->'condicoesHash') <> 'string'
    OR jsonb_typeof(foto->'versaoCondicoesId') <> 'string'
    OR jsonb_typeof(foto->'cobranca') <> 'object'
    OR jsonb_typeof(foto->'calculo') <> 'object'
    OR jsonb_typeof(foto->'comissoes') <> 'array' THEN
    RAISE EXCEPTION 'Fotografia de invalidação possui estrutura não canônica';
  END IF;
  c := foto->'cobranca'; calc := foto->'calculo';
  IF NOT (c ?& ARRAY['id','versao','moeda','valorNegociado','valorRecebido','valorLiquidadoCredito','vencimento'])
    OR (c - 'id' - 'versao' - 'moeda' - 'valorNegociado' - 'valorRecebido' - 'valorLiquidadoCredito' - 'vencimento') <> '{}'::jsonb
    OR jsonb_typeof(c->'id') <> 'string' OR jsonb_typeof(c->'versao') <> 'number'
    OR jsonb_typeof(c->'moeda') <> 'string' OR jsonb_typeof(c->'valorNegociado') <> 'string'
    OR jsonb_typeof(c->'valorLiquidadoCredito') <> 'string' OR jsonb_typeof(c->'vencimento') <> 'string'
    OR jsonb_typeof(c->'valorRecebido') NOT IN ('string','null')
    OR NOT (calc ?& ARRAY['creditoAnterior','creditoNovo'])
    OR (calc - 'creditoAnterior' - 'creditoNovo') <> '{}'::jsonb
    OR jsonb_typeof(calc->'creditoAnterior') <> 'string' OR jsonb_typeof(calc->'creditoNovo') <> 'string'
    OR (c->>'versao') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Fotografia de invalidação possui cobrança ou cálculo inválido';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(foto->'comissoes') x
    WHERE jsonb_typeof(x) <> 'object'
      OR NOT (x ?& ARRAY['id','tipo','status','percentual','valor','valorBase'])
      OR (x - 'id' - 'tipo' - 'status' - 'percentual' - 'valor' - 'valorBase') <> '{}'::jsonb
      OR jsonb_typeof(x->'id') <> 'string' OR jsonb_typeof(x->'tipo') <> 'string'
      OR jsonb_typeof(x->'status') <> 'string' OR jsonb_typeof(x->'percentual') <> 'string'
      OR jsonb_typeof(x->'valor') <> 'string' OR jsonb_typeof(x->'valorBase') NOT IN ('string','null')
  ) THEN RAISE EXCEPTION 'Fotografia de invalidação possui comissões inválidas'; END IF;
  SELECT string_agg(format('{"id":%s,"percentual":%s,"status":%s,"tipo":%s,"valor":%s,"valorBase":%s}',
    to_jsonb(x->>'id')::text, to_jsonb(x->>'percentual')::text, to_jsonb(x->>'status')::text,
    to_jsonb(x->>'tipo')::text, to_jsonb(x->>'valor')::text,
    CASE WHEN jsonb_typeof(x->'valorBase') = 'null' THEN 'null' ELSE to_jsonb(x->>'valorBase')::text END), ',' ORDER BY ord)
  INTO itens FROM jsonb_array_elements(foto->'comissoes') WITH ORDINALITY AS a(x, ord);
  RETURN format('{"calculo":{"creditoAnterior":%s,"creditoNovo":%s},"cobranca":{"id":%s,"moeda":%s,"valorLiquidadoCredito":%s,"valorNegociado":%s,"valorRecebido":%s,"vencimento":%s,"versao":%s},"comissoes":[%s],"condicoesHash":%s,"revisaoHash":%s,"versaoCondicoesId":%s}',
    to_jsonb(calc->>'creditoAnterior')::text, to_jsonb(calc->>'creditoNovo')::text,
    to_jsonb(c->>'id')::text, to_jsonb(c->>'moeda')::text, to_jsonb(c->>'valorLiquidadoCredito')::text,
    to_jsonb(c->>'valorNegociado')::text,
    CASE WHEN jsonb_typeof(c->'valorRecebido') = 'null' THEN 'null' ELSE to_jsonb(c->>'valorRecebido')::text END,
    to_jsonb(c->>'vencimento')::text, c->>'versao', coalesce(itens,''),
    to_jsonb(foto->>'condicoesHash')::text, to_jsonb(foto->>'revisaoHash')::text,
    to_jsonb(foto->>'versaoCondicoesId')::text);
END $$;

ALTER TABLE "InvalidacaoAcertoTaxaAditivo"
  ADD CONSTRAINT "InvalidacaoAcertoTaxaAditivo_hash_canonico_217"
  CHECK ("fotografiaAtualHash" = encode(sha256(convert_to(dct03_fotografia_invalidacao_canonica_217("fotografiaAtual"),'UTF8')),'hex'));

-- Substitui integralmente a guarda de 213. O trigger daquela migração chama
-- esta função por nome, portanto não fica nenhuma leitura da versão antiga.
CREATE OR REPLACE FUNCTION "dct03_invalidacao_acerto_taxa_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaAcertoTaxaAditivo"%ROWTYPE; c "Cobranca"%ROWTYPE;
  v "VersaoCondicoesAditivo"%ROWTYPE; f "ConferenciaFinalAditivo"%ROWTYPE;
  u "Usuario"%ROWTYPE; credito_anterior numeric; credito_total numeric;
  esperada jsonb; comissoes jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Invalidação de acerto de taxa é append-only'; END IF;
  SELECT * INTO p FROM "PropostaAcertoTaxaAditivo" WHERE id=NEW."propostaId" FOR UPDATE;
  SELECT * INTO c FROM "Cobranca" WHERE id=p."cobrancaId" FOR UPDATE;
  -- A versão vigente pertence à matrícula; pode ser de outro aditivo/conclusão.
  SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE "matriculaId"=p."matriculaId"
    ORDER BY "vigenciaInicio" DESC, versao DESC LIMIT 1 FOR SHARE;
  SELECT * INTO f FROM "ConferenciaFinalAditivo" WHERE id=v."conferenciaFinalId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id=NEW."resolvedorId" FOR SHARE;
  PERFORM id FROM "Comissao" WHERE "matriculaId"=p."matriculaId" ORDER BY id FOR UPDATE;
  IF p.id IS NULL OR p.status <> 'APROVADA' OR EXISTS (SELECT 1 FROM "AplicacaoAcertoTaxaAditivo" a WHERE a."propostaId"=p.id)
    OR p."fotografiaHash" IS DISTINCT FROM NEW."fotografiaOriginalHash"
    OR u.id IS NULL OR NOT u.ativo OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes)))
    OR u.id=p."preparadorId" OR c.id IS NULL OR v.id IS NULL OR f.id IS NULL
    OR NOT EXISTS (SELECT 1 FROM "ConclusaoAssinaturaAditivo" x WHERE x.id=f."conclusaoId") THEN
    RAISE EXCEPTION 'Invalidação exige acerto aprovado sem aplicação e resolvedor financeiro independente';
  END IF;
  SELECT coalesce(sum(o.valor),0) INTO credito_anterior FROM "OrigemCreditoAcertoTaxaAditivo" o WHERE o."cobrancaId"=c.id;
  credito_total := greatest(0,coalesce(c."valorRecebido",0)+c."valorLiquidadoCredito"-p."valorNovo");
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'tipo',x.tipo::text,'status',x.status::text,
    'percentual',to_char(x.percentual,'FM9999999990.00'),'valor',to_char(x.valor,'FM9999999990.00'),
    'valorBase',CASE WHEN x."valorBase" IS NULL THEN NULL ELSE to_char(x."valorBase",'FM9999999990.00') END) ORDER BY x.id),'[]'::jsonb)
    INTO comissoes FROM "Comissao" x WHERE x."matriculaId"=p."matriculaId";
  esperada := jsonb_build_object('revisaoHash',f."revisaoHash",'condicoesHash',v."condicoesHash",'versaoCondicoesId',v.id,
    'cobranca',jsonb_build_object('id',c.id,'versao',c.versao,'moeda',c.moeda,
      'valorNegociado',to_char(c."valorNegociado",'FM9999999990.00'),
      'valorRecebido',CASE WHEN c."valorRecebido" IS NULL THEN NULL ELSE to_char(c."valorRecebido",'FM9999999990.00') END,
      'valorLiquidadoCredito',to_char(c."valorLiquidadoCredito",'FM9999999990.00'),
      'vencimento',to_char(c.vencimento,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    'calculo',jsonb_build_object('creditoAnterior',to_char(credito_anterior,'FM9999999990.00'),
      'creditoNovo',to_char(greatest(0,credito_total-credito_anterior),'FM9999999990.00')),
    'comissoes',comissoes);
  -- A mesma forma canônica que hashSubstituicao: chaves ordenadas em todos os
  -- objetos e a ordem de arrays preservada. A foto TS já busca comissões por id.
  IF dct03_fotografia_invalidacao_canonica_217(NEW."fotografiaAtual")
       IS DISTINCT FROM dct03_fotografia_invalidacao_canonica_217(esperada)
    OR NEW."fotografiaAtualHash" IS DISTINCT FROM encode(sha256(convert_to(dct03_fotografia_invalidacao_canonica_217(esperada),'UTF8')),'hex') THEN
    RAISE EXCEPTION 'Fotografia atual não corresponde ao estado material bloqueado';
  END IF;
  IF NEW."fotografiaAtualHash" = p."fotografiaHash" THEN
    RAISE EXCEPTION 'Não invalide acerto cuja fotografia material ainda está vigente';
  END IF;
  RETURN NEW;
END $$;
COMMIT;
