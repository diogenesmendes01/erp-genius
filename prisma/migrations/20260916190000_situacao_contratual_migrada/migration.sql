-- Corretiva reservada: 20260916190000_situacao_contratual_migrada
--
-- Mantém a assinatura timestamp sem fuso usada pelos gatilhos existentes.  Os
-- instantes do ramo migrado são convertidos explicitamente de/para UTC; assim a
-- resposta não depende de TimeZone da sessão.  CREATE OR REPLACE conserva o OID
-- da função, do qual dependem os gatilhos já publicados.
CREATE OR REPLACE FUNCTION situacao_matricula_no_instante(matricula_id TEXT, instante TIMESTAMP)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE
  status_atual TEXT;
  ativada_em TIMESTAMP;
  status_conferido TEXT;
  encerramento RECORD;
  movimento RECORD;
  snapshot JSONB;
  data_texto TEXT;
  fuso TEXT;
  fuso_unico TEXT;
  estado_atual TEXT := 'ATIVA';
  estado_na_aula TEXT := 'ATIVA';
  aplicado_anterior TIMESTAMP;
  data_anterior DATE;
  data_movimento DATE;
  data_aula DATE;
  indice INTEGER := 0;

  -- Variáveis exclusivas do caminho de fatos migrados.
  instante_utc TIMESTAMPTZ;
  fato RECORD;
  ha_fatos BOOLEAN;
  ordem_esperada INTEGER := 1;
  efetivo_anterior TIMESTAMPTZ;
  primeiro_efetivo TIMESTAMPTZ;
  ultimo_importado TIMESTAMPTZ;
  instante_movimento TIMESTAMPTZ;
  instante_aplicacao TIMESTAMPTZ;
  instante_anterior TIMESTAMPTZ;
  aplicacao_anterior TIMESTAMPTZ;
  estado_migrado TEXT;
  estado_migrado_na_aula TEXT := 'NAO_ATIVADA';
  estado_proximo TEXT;
  estado_anterior_declarado TEXT;
  candidatos_meia_noite INTEGER;
BEGIN
  IF instante IS NULL OR NOT isfinite(instante) THEN RETURN 'A_CONFERIR'; END IF;

  -- Um fato importado é uma fonte histórica completa e substitui o caminho
  -- comercial legado, exatamente como historico-situacao.ts.
  SELECT EXISTS(
    SELECT 1 FROM "FatoSituacaoMatriculaMigracao" f
    WHERE f."matriculaId" = matricula_id
  ) INTO ha_fatos;

  IF ha_fatos THEN
    instante_utc := instante AT TIME ZONE 'UTC';
    SELECT status::text, "ativadaEm" INTO status_atual, ativada_em
      FROM "Matricula" WHERE id = matricula_id;
    IF NOT FOUND THEN RETURN 'A_CONFERIR'; END IF;

    -- Ordem e tempo dos fatos são evidência, não uma aproximação do status atual.
    FOR fato IN
      SELECT f.ordem, f.tipo::text AS tipo, f."efetivoEm"
        FROM "FatoSituacaoMatriculaMigracao" f
       WHERE f."matriculaId" = matricula_id
       ORDER BY f.ordem
    LOOP
      IF fato.ordem <> ordem_esperada
         OR fato."efetivoEm" IS NULL OR NOT isfinite(fato."efetivoEm")
         OR (ordem_esperada = 1 AND fato.tipo <> 'ATIVACAO')
         OR (ordem_esperada > 1 AND fato."efetivoEm" <= efetivo_anterior) THEN
        RETURN 'A_CONFERIR';
      END IF;
      estado_proximo := CASE fato.tipo
        WHEN 'ATIVACAO' THEN 'ATIVA'
        WHEN 'PAUSA' THEN 'PAUSADA'
        WHEN 'ENCERRAMENTO' THEN 'ENCERRADA'
        WHEN 'CANCELAMENTO' THEN 'CANCELADA'
        ELSE NULL
      END;
      IF estado_proximo IS NULL THEN RETURN 'A_CONFERIR'; END IF;
      IF ordem_esperada = 1 THEN primeiro_efetivo := fato."efetivoEm"; END IF;
      efetivo_anterior := fato."efetivoEm";
      ultimo_importado := fato."efetivoEm";
      ordem_esperada := ordem_esperada + 1;
    END LOOP;

    -- ativadaEm comercial é opcional na importação, mas se existir tem de ser
    -- exatamente o instante do primeiro fato, interpretado como UTC.
    IF ativada_em IS NOT NULL
       AND (NOT isfinite(ativada_em) OR (ativada_em AT TIME ZONE 'UTC') <> primeiro_efetivo) THEN
      RETURN 'A_CONFERIR';
    END IF;

    -- Valida cada pausa/retomada posterior e reconstrói sua meia-noite local
    -- usando a mesma procura de offsets de instanteDaGrade(..., "00:00", fuso).
    FOR movimento IN
      SELECT p.snapshot, p."aplicadaEm", 'PAUSADA'::text AS estado
        FROM "ItemPropostaPausa" i JOIN "PropostaPausaMatriculas" p ON p.id = i."propostaId"
       WHERE i."matriculaId" = matricula_id AND p.status = 'APLICADA'
      UNION ALL
      SELECT p.snapshot, p."aplicadaEm", 'ATIVA'::text AS estado
        FROM "ItemPropostaRetomadaMatriculas" i JOIN "PropostaRetomadaMatriculas" p ON p.id = i."propostaId"
       WHERE i."matriculaId" = matricula_id AND p.status = 'APLICADA'
    LOOP
      snapshot := movimento.snapshot;
      IF snapshot IS NULL OR jsonb_typeof(snapshot) <> 'object'
         OR movimento."aplicadaEm" IS NULL OR NOT isfinite(movimento."aplicadaEm") THEN
        RETURN 'A_CONFERIR';
      END IF;
      data_texto := CASE WHEN movimento.estado = 'PAUSADA'
        THEN snapshot ->> 'dataEfetiva' ELSE snapshot ->> 'retorno' END;
      fuso := btrim(snapshot ->> 'fusoInstitucional');
      IF NOT COALESCE(
        jsonb_typeof(snapshot -> (CASE WHEN movimento.estado = 'PAUSADA' THEN 'dataEfetiva' ELSE 'retorno' END)) = 'string'
        AND jsonb_typeof(snapshot -> 'fusoInstitucional') = 'string'
        AND data_texto ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND length(fuso) BETWEEN 1 AND 100
        AND fuso ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+\-]+)*$'
        AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = fuso), false) THEN
        RETURN 'A_CONFERIR';
      END IF;
      BEGIN
        data_movimento := data_texto::date;
        -- Postgres aceita alguns textos que JS normalizaria; a volta para texto
        -- exige a mesma data civil canônica aceita por DataCivilSchema.
        IF to_char(data_movimento, 'YYYY-MM-DD') <> data_texto THEN RETURN 'A_CONFERIR'; END IF;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RETURN 'A_CONFERIR';
      END;

      -- Replica o algoritmo TS: amostra offsets entre -48 h e +48 h, aceita
      -- somente uma solução que renderize a meia-noite local solicitada.
      SELECT count(DISTINCT candidato) INTO candidatos_meia_noite
        FROM (
          SELECT (data_movimento::timestamp AT TIME ZONE 'UTC')
                 - (((amostra AT TIME ZONE fuso) AT TIME ZONE 'UTC') - amostra) AS candidato
            FROM generate_series(
              (data_movimento::timestamp AT TIME ZONE 'UTC') - interval '48 hours',
              (data_movimento::timestamp AT TIME ZONE 'UTC') + interval '48 hours',
              interval '6 hours'
            ) AS gs(amostra)
        ) offsets
       WHERE candidato AT TIME ZONE fuso = data_movimento::timestamp;
      IF candidatos_meia_noite <> 1 THEN RETURN 'A_CONFERIR'; END IF;
      SELECT candidato INTO instante_movimento
        FROM (
          SELECT DISTINCT (data_movimento::timestamp AT TIME ZONE 'UTC')
                 - (((amostra AT TIME ZONE fuso) AT TIME ZONE 'UTC') - amostra) AS candidato
            FROM generate_series(
              (data_movimento::timestamp AT TIME ZONE 'UTC') - interval '48 hours',
              (data_movimento::timestamp AT TIME ZONE 'UTC') + interval '48 hours',
              interval '6 hours'
            ) AS gs(amostra)
        ) offsets
       WHERE candidato AT TIME ZONE fuso = data_movimento::timestamp;
      instante_aplicacao := movimento."aplicadaEm" AT TIME ZONE 'UTC';
      IF instante_movimento <= ultimo_importado THEN RETURN 'A_CONFERIR'; END IF;

      -- A tabela temporária abaixo é simulada no segundo percurso, sem gravar.
      -- A validação já elimina erros de parse antes de ordenar, como no TS.
      -- O valor é reavaliado no percurso final a partir das mesmas fontes.
    END LOOP;

    -- Inclui fatos, movimentos operacionais e encerramento numa única linha do tempo.
    estado_migrado := NULL;
    estado_migrado_na_aula := 'NAO_ATIVADA';
    instante_anterior := NULL;
    aplicacao_anterior := NULL;
    FOR movimento IN
      SELECT * FROM (
        SELECT f."efetivoEm" AS efetivo, 'epoch'::timestamptz AS aplicado,
               CASE f.tipo::text WHEN 'ATIVACAO' THEN 'ATIVA' WHEN 'PAUSA' THEN 'PAUSADA'
                 WHEN 'ENCERRAMENTO' THEN 'ENCERRADA' WHEN 'CANCELAMENTO' THEN 'CANCELADA' END AS estado,
               NULL::text AS anterior
          FROM "FatoSituacaoMatriculaMigracao" f WHERE f."matriculaId" = matricula_id
        UNION ALL
        SELECT ((p.snapshot->>'dataEfetiva')::date::timestamp AT TIME ZONE btrim(p.snapshot->>'fusoInstitucional')),
               p."aplicadaEm" AT TIME ZONE 'UTC', 'PAUSADA'::text, NULL::text
          FROM "ItemPropostaPausa" i JOIN "PropostaPausaMatriculas" p ON p.id=i."propostaId"
         WHERE i."matriculaId"=matricula_id AND p.status='APLICADA'
        UNION ALL
        SELECT ((p.snapshot->>'retorno')::date::timestamp AT TIME ZONE btrim(p.snapshot->>'fusoInstitucional')),
               p."aplicadaEm" AT TIME ZONE 'UTC', 'ATIVA'::text, NULL::text
          FROM "ItemPropostaRetomadaMatriculas" i JOIN "PropostaRetomadaMatriculas" p ON p.id=i."propostaId"
         WHERE i."matriculaId"=matricula_id AND p.status='APLICADA'
        UNION ALL
        SELECT e."limiteVinculo" AT TIME ZONE 'UTC', '275760-09-13 00:00:00+00'::timestamptz,
               'ENCERRADA'::text, e."statusAnterior"
          FROM "RegistroEncerramentoMatricula" e WHERE e."matriculaId"=matricula_id
      ) linha_do_tempo
      ORDER BY efetivo, aplicado
    LOOP
      IF movimento.efetivo IS NULL OR NOT isfinite(movimento.efetivo)
         OR movimento.aplicado IS NULL OR NOT isfinite(movimento.aplicado)
         OR (movimento.efetivo <= ultimo_importado AND movimento.aplicado <> 'epoch'::timestamptz)
         OR estado_migrado IN ('ENCERRADA','CANCELADA')
         OR estado_migrado = movimento.estado
         OR (movimento.anterior IS NOT NULL AND movimento.anterior <> estado_migrado)
         OR (instante_anterior IS NOT NULL AND movimento.efetivo = instante_anterior AND movimento.aplicado = aplicacao_anterior) THEN
        RETURN 'A_CONFERIR';
      END IF;
      estado_migrado := movimento.estado;
      IF movimento.efetivo <= instante_utc THEN estado_migrado_na_aula := estado_migrado; END IF;
      instante_anterior := movimento.efetivo;
      aplicacao_anterior := movimento.aplicado;
    END LOOP;
    IF estado_migrado <> status_atual THEN RETURN 'A_CONFERIR'; END IF;
    RETURN estado_migrado_na_aula;
  END IF;

  -- Caminho legado da migration 20260915091000, preservado integralmente.
  SELECT status::text, "ativadaEm" INTO status_atual, ativada_em
    FROM "Matricula" WHERE id = matricula_id;
  IF NOT FOUND OR ativada_em IS NULL OR NOT isfinite(ativada_em) THEN RETURN 'A_CONFERIR'; END IF;
  IF instante < ativada_em THEN RETURN 'NAO_ATIVADA'; END IF;

  SELECT "statusAnterior", "limiteVinculo" INTO encerramento
    FROM "RegistroEncerramentoMatricula" WHERE "matriculaId" = matricula_id;
  IF FOUND THEN
    IF status_atual <> 'ENCERRADA' OR encerramento."statusAnterior" NOT IN ('ATIVA', 'PAUSADA')
       OR encerramento."limiteVinculo" IS NULL OR NOT isfinite(encerramento."limiteVinculo")
       OR encerramento."limiteVinculo" < ativada_em THEN
      RETURN 'A_CONFERIR';
    END IF;
    IF instante >= encerramento."limiteVinculo" THEN RETURN 'ENCERRADA'; END IF;
    status_conferido := encerramento."statusAnterior";
  ELSE
    status_conferido := status_atual;
  END IF;
  IF status_conferido NOT IN ('ATIVA', 'PAUSADA') THEN RETURN 'A_CONFERIR'; END IF;

  -- Primeiro valida toda a fonte. Isso corresponde aos safeParse do app antes
  -- de ordenar os movimentos por data civil e instante de aplicação.
  FOR movimento IN
    SELECT p.snapshot, p."aplicadaEm", 'PAUSADA'::text AS estado
      FROM "ItemPropostaPausa" i JOIN "PropostaPausaMatriculas" p ON p.id = i."propostaId"
      WHERE i."matriculaId" = matricula_id AND p.status = 'APLICADA'
    UNION ALL
    SELECT p.snapshot, p."aplicadaEm", 'ATIVA'::text AS estado
      FROM "ItemPropostaRetomadaMatriculas" i JOIN "PropostaRetomadaMatriculas" p ON p.id = i."propostaId"
      WHERE i."matriculaId" = matricula_id AND p.status = 'APLICADA'
  LOOP
    snapshot := movimento.snapshot;
    IF snapshot IS NULL OR jsonb_typeof(snapshot) <> 'object'
       OR movimento."aplicadaEm" IS NULL OR NOT isfinite(movimento."aplicadaEm") THEN
      RETURN 'A_CONFERIR';
    END IF;
    IF movimento.estado = 'PAUSADA' THEN data_texto := snapshot ->> 'dataEfetiva';
    ELSE data_texto := snapshot ->> 'retorno'; END IF;
    fuso := snapshot ->> 'fusoInstitucional';
    IF NOT COALESCE(jsonb_typeof(snapshot -> (CASE WHEN movimento.estado = 'PAUSADA' THEN 'dataEfetiva' ELSE 'retorno' END)) = 'string'
       AND jsonb_typeof(snapshot -> 'fusoInstitucional') = 'string'
       AND data_texto ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       AND fuso ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+\-]+)*$', false) THEN
      RETURN 'A_CONFERIR';
    END IF;
    PERFORM data_texto::date;
    PERFORM instante AT TIME ZONE 'UTC' AT TIME ZONE fuso;
    IF fuso_unico IS NULL THEN fuso_unico := fuso;
    ELSIF fuso_unico <> fuso THEN RETURN 'A_CONFERIR'; END IF;
  END LOOP;

  FOR movimento IN
    SELECT movimentos.data_texto, movimentos.fuso, movimentos."aplicadaEm", movimentos.estado FROM (
      SELECT p.snapshot ->> 'dataEfetiva' AS data_texto, p.snapshot ->> 'fusoInstitucional' AS fuso,
        p."aplicadaEm", 'PAUSADA'::text AS estado
      FROM "ItemPropostaPausa" i JOIN "PropostaPausaMatriculas" p ON p.id = i."propostaId"
      WHERE i."matriculaId" = matricula_id AND p.status = 'APLICADA'
      UNION ALL
      SELECT p.snapshot ->> 'retorno', p.snapshot ->> 'fusoInstitucional', p."aplicadaEm", 'ATIVA'::text
      FROM "ItemPropostaRetomadaMatriculas" i JOIN "PropostaRetomadaMatriculas" p ON p.id = i."propostaId"
      WHERE i."matriculaId" = matricula_id AND p.status = 'APLICADA'
    ) movimentos
    ORDER BY movimentos.data_texto, movimentos."aplicadaEm"
  LOOP
    data_movimento := movimento.data_texto::date;
    IF movimento.estado = estado_atual
       OR (indice > 0 AND data_movimento = data_anterior AND movimento."aplicadaEm" = aplicado_anterior) THEN
      RETURN 'A_CONFERIR';
    END IF;
    IF data_movimento < ((ativada_em AT TIME ZONE 'UTC') AT TIME ZONE movimento.fuso)::date THEN
      RETURN 'A_CONFERIR';
    END IF;
    estado_atual := movimento.estado;
    data_aula := ((instante AT TIME ZONE 'UTC') AT TIME ZONE movimento.fuso)::date;
    IF data_movimento <= data_aula THEN estado_na_aula := movimento.estado; END IF;
    indice := indice + 1;
    data_anterior := data_movimento;
    aplicado_anterior := movimento."aplicadaEm";
  END LOOP;
  IF estado_atual <> status_conferido THEN RETURN 'A_CONFERIR'; END IF;
  RETURN estado_na_aula;
EXCEPTION WHEN OTHERS THEN
  RETURN 'A_CONFERIR';
END $$;
