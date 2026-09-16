-- Q117: a apuração por hora conserva as regras-base e pode referenciar o preço
-- estruturado da versão de aditivo vigente no encontro.
CREATE OR REPLACE FUNCTION validar_conferencia_ocorrencia_horas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o "OcorrenciaParticular"%ROWTYPE; c "CondicoesHorasMatricula"%ROWTYPE;
 e "EncontroAgenda"%ROWTYPE; m "Matricula"%ROWTYPE; u "Usuario"%ROWTYPE; resultado text; minutos numeric; valor numeric;
 aditivo_inicio "VersaoCondicoesAditivo"%ROWTYPE; aditivo_fim "VersaoCondicoesAditivo"%ROWTYPE; preco_hora text;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Conferências financeiras são preservadas.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO e FROM "EncontroAgenda" WHERE id=NEW."encontroId" FOR UPDATE;
 SELECT * INTO o FROM "OcorrenciaParticular" WHERE id=NEW."ocorrenciaId";
 SELECT * INTO c FROM "CondicoesHorasMatricula" WHERE id=NEW."condicoesId";
 SELECT * INTO m FROM "Matricula" WHERE id=o."matriculaId" FOR UPDATE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."conferenteId" FOR SHARE;
 IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['FINANCEIRO','ADMINISTRADOR']::"Papel"[]) THEN RAISE EXCEPTION 'Conferente financeiro sem permissão.'; END IF;
 IF o."encontroId" IS DISTINCT FROM e.id OR e."matriculaId" IS DISTINCT FROM o."matriculaId" OR c."matriculaId" IS DISTINCT FROM o."matriculaId" OR c.status IS DISTINCT FROM 'APROVADA'
  OR e.inicio IS DISTINCT FROM o.inicio OR e.fim IS DISTINCT FROM o.fim OR e."turmaId" IS NOT NULL
  OR EXISTS (SELECT 1 FROM "OcorrenciaParticular" WHERE "encontroId"=e.id AND versao>o.versao)
  OR EXISTS (SELECT 1 FROM "ReservaHorasCompradas" WHERE "encontroId"=e.id) THEN RAISE EXCEPTION 'Origens da conferência divergentes ou horas antecipadas pendentes.'; END IF;
 IF m."contratoOk" IS DISTINCT FROM true OR m."confirmacaoContratoEm" IS NULL OR m."contratoDocumentoId" IS DISTINCT FROM c."documentoId" OR NEW.moeda IS DISTINCT FROM m.moeda OR c.regras->>'moeda' IS DISTINCT FROM NEW.moeda THEN RAISE EXCEPTION 'Contrato e moeda incompatíveis.'; END IF;
 PERFORM id FROM "Documento" WHERE id=c."documentoId" FOR SHARE;
 IF NOT EXISTS (SELECT 1 FROM "Documento" WHERE id=c."documentoId" AND categoria='CONTRATO' AND NOT arquivado AND ("matriculaId"=m.id OR "leadId"=m."leadId")) THEN RAISE EXCEPTION 'Documento indisponível.'; END IF;
 IF (c.regras->>'vigenteDesde')::timestamptz > o.inicio AT TIME ZONE 'UTC' OR EXISTS (
  SELECT 1 FROM "CondicoesHorasMatricula" x WHERE x."matriculaId"=m.id AND x.id<>c.id AND x.status IN ('PENDENTE','APROVADA')
   AND (x.regras->>'vigenteDesde')::timestamptz < o.fim AT TIME ZONE 'UTC'
   AND (x.status='PENDENTE' OR (x.regras->>'vigenteDesde')::timestamptz > (c.regras->>'vigenteDesde')::timestamptz
    OR ((x.regras->>'vigenteDesde')::timestamptz=(c.regras->>'vigenteDesde')::timestamptz AND x.versao>c.versao))
 ) THEN RAISE EXCEPTION 'Confira a vigência contratual.'; END IF;
 SELECT * INTO aditivo_inicio FROM "VersaoCondicoesAditivo" WHERE "matriculaId"=m.id AND "vigenciaInicio" <= o.inicio ORDER BY "vigenciaInicio" DESC, versao DESC LIMIT 1 FOR SHARE;
 IF EXISTS (SELECT 1 FROM "VersaoCondicoesAditivo" v WHERE v."matriculaId"=m.id AND v."vigenciaInicio" > o.inicio AND v."vigenciaInicio" < o.fim
   AND (v.condicoes->'HORA_VALOR' IS DISTINCT FROM aditivo_inicio.condicoes->'HORA_VALOR'
     OR v.condicoes->'MOEDA' IS DISTINCT FROM aditivo_inicio.condicoes->'MOEDA'
     OR v.condicoes->'REGIME' IS DISTINCT FROM aditivo_inicio.condicoes->'REGIME')) THEN
   RAISE EXCEPTION 'Mudança de preço, moeda ou regime durante o encontro exige revisão.';
 END IF;
 preco_hora := c.regras->>'valorHora';
 IF aditivo_inicio.id IS NOT NULL THEN
   IF jsonb_typeof(aditivo_inicio.condicoes->'MOEDA') IS NOT NULL
     AND (aditivo_inicio.condicoes->'MOEDA'->>'tipo' IS DISTINCT FROM 'MOEDA' OR aditivo_inicio.condicoes->'MOEDA'->>'moeda' IS DISTINCT FROM m.moeda) THEN
     RAISE EXCEPTION 'Moeda da versão de aditivo incompatível com o contrato.';
   END IF;
   IF jsonb_typeof(aditivo_inicio.condicoes->'REGIME') IS NOT NULL
     AND (aditivo_inicio.condicoes->'REGIME'->>'tipo' IS DISTINCT FROM 'REGIME' OR aditivo_inicio.condicoes->'REGIME'->>'regime' IS DISTINCT FROM 'HORA_PARTICULAR') THEN
     RAISE EXCEPTION 'Regime da versão de aditivo incompatível com a apuração por hora.';
   END IF;
   IF aditivo_inicio.condicoes ? 'HORA_VALOR' THEN
     IF jsonb_typeof(aditivo_inicio.condicoes->'HORA_VALOR') IS DISTINCT FROM 'object'
       OR aditivo_inicio.condicoes->'HORA_VALOR'->>'tipo' IS DISTINCT FROM 'DINHEIRO'
       OR aditivo_inicio.condicoes->'HORA_VALOR'->>'valor' !~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'
       OR aditivo_inicio.condicoes->'HORA_VALOR'->>'moeda' IS DISTINCT FROM m.moeda THEN
       RAISE EXCEPTION 'Preço por hora da versão de aditivo é inválido.';
     END IF;
     preco_hora := aditivo_inicio.condicoes->'HORA_VALOR'->>'valor';
   END IF;
   IF NOT (NEW.snapshot ? 'aditivo') OR NEW.snapshot->'aditivo' IS DISTINCT FROM jsonb_build_object('id', aditivo_inicio.id, 'versao', aditivo_inicio.versao, 'condicoesHash', aditivo_inicio."condicoesHash") THEN
     RAISE EXCEPTION 'Memória não referencia a versão de aditivo vigente.';
   END IF;
 ELSE
   IF (NEW.snapshot ? 'aditivo') AND NEW.snapshot->'aditivo' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Memória de ocorrência sem aditivo não pode referenciar versão.'; END IF;
   IF (NEW.snapshot ? 'precoHoraAplicado') AND NEW.snapshot->>'precoHoraAplicado' IS DISTINCT FROM preco_hora THEN RAISE EXCEPTION 'Memória não corresponde ao preço por hora aplicado.'; END IF;
 END IF;
 IF aditivo_inicio.id IS NOT NULL AND NEW.snapshot->>'precoHoraAplicado' IS DISTINCT FROM preco_hora THEN RAISE EXCEPTION 'Memória não corresponde ao preço por hora aplicado.'; END IF;
 IF o.tipo IN ('CANCELAMENTO_ALUNO','CANCELAMENTO_ESCOLA') THEN
  IF e.status <> 'CANCELADO' OR NOT EXISTS (SELECT 1 FROM "DecisaoCancelamentoParticular" d JOIN "PropostaCancelamentoParticular" p ON p.id=d."propostaId" WHERE p."encontroId"=e.id AND d.aprovada AND p.origem=CASE WHEN o.tipo='CANCELAMENTO_ALUNO' THEN 'ALUNO' ELSE 'ESCOLA' END) THEN RAISE EXCEPTION 'Cancelamento incompatível.'; END IF;
 ELSE
  IF e.status NOT IN ('PREVISTO','MINISTRADO') THEN RAISE EXCEPTION 'Estado incompatível com a ocorrência.'; END IF;
 END IF;
 resultado := CASE o.tipo WHEN 'REALIZADA' THEN 'REALIZADA' WHEN 'FALTA_ALUNO' THEN 'FALTA_COBRAVEL'
  WHEN 'CANCELAMENTO_ESCOLA' THEN 'CANCELAMENTO_ESCOLA' ELSE
   CASE WHEN o."comunicadoEm" <= o.inicio - make_interval(mins => (c.regras->>'antecedenciaCancelamentoMinutos')::integer) THEN 'CANCELAMENTO_NO_PRAZO' ELSE 'CANCELAMENTO_TARDIO' END END;
 minutos := extract(epoch FROM (o.fim-o.inicio))/60;
 valor := CASE WHEN resultado IN ('REALIZADA','FALTA_COBRAVEL','CANCELAMENTO_TARDIO') THEN round(preco_hora::numeric * minutos/60,2) ELSE 0 END;
 IF minutos<=0 OR minutos<>trunc(minutos) OR NEW.minutos<>minutos OR NEW.valor<>valor OR NEW.desfecho<>resultado OR length(trim(NEW.motivo))<5 THEN RAISE EXCEPTION 'Cálculo financeiro divergente.'; END IF;
 IF NEW.snapshot->'regras' IS DISTINCT FROM c.regras OR NEW.snapshot->>'ocorrenciaId' IS DISTINCT FROM o.id OR NEW.snapshot->>'condicoesId' IS DISTINCT FROM c.id OR NEW.snapshot->>'matriculaId' IS DISTINCT FROM m.id
  OR (NEW.snapshot->>'valorApurado')::numeric IS DISTINCT FROM valor THEN RAISE EXCEPTION 'Memória financeira divergente.'; END IF;
 NEW."conferidaEm" := clock_timestamp() AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;
