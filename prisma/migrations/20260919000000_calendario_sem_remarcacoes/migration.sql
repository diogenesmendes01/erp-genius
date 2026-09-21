-- Uma revisão conjunta também pode apenas publicar uma nova versão do
-- calendário. Nesse caso a aplicação continua exigindo a mesma decisão e o
-- mesmo evento canônicos, mas ambos os conjuntos materiais são vazios.
CREATE OR REPLACE FUNCTION "validar_aplicacao_replanejamento_material_167"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_calendario TEXT;
  v_decisor TEXT;
  v_evento JSONB;
  v_snapshot JSONB;
  v_total INTEGER;
  v_evento_total INTEGER;
  v_ids_total INTEGER;
BEGIN
  SELECT r."calendarioId", d."decisorId", r.snapshot
    INTO v_calendario, v_decisor, v_snapshot
    FROM "RascunhoReplanejamento" r
    JOIN "DecisaoReplanejamentoConjunto" d ON d.id = NEW."decisaoId"
    WHERE r.id = NEW."rascunhoId";

  IF NOT EXISTS (
    SELECT 1 FROM "DecisaoCalendarioEscolar" c
      WHERE c."calendarioId" = v_calendario
        AND c.aprovada
        AND c."decisorId" = v_decisor
  ) THEN
    RAISE EXCEPTION 'Aplicação conjunta exige calendário publicado pela pessoa decisora';
  END IF;

  SELECT e.payload INTO v_evento
    FROM "Evento" e
    WHERE e.tipo = 'ReplanejamentoConjuntoAplicado'
      AND e."agregadoTipo" = 'ConfiguracaoOperacional'
      AND e."agregadoId" = 'escola'
      AND e.payload->>'revisaoId' = NEW."rascunhoId"
      AND e.payload->>'decisaoId' = NEW."decisaoId"
      AND e.payload->>'aprovada' = 'true';
  IF v_evento IS NULL THEN
    RAISE EXCEPTION 'Aplicação conjunta exige evento transacional canônico';
  END IF;
  IF jsonb_typeof(v_snapshot->'revisoes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Aplicação conjunta exige fotografia válida da revisão';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_snapshot->'revisoes') t
      WHERE jsonb_typeof(t) IS DISTINCT FROM 'object'
        OR jsonb_typeof(t->'previsao') IS DISTINCT FROM 'object'
        OR jsonb_typeof(t->'previsao'->'propostas') IS DISTINCT FROM 'array'
        OR EXISTS (
          SELECT 1
            FROM jsonb_array_elements(t->'previsao'->'propostas') p
            WHERE jsonb_typeof(p) IS DISTINCT FROM 'object'
              OR jsonb_typeof(p->'alterado') IS DISTINCT FROM 'boolean'
        )
  ) THEN
    RAISE EXCEPTION 'Aplicação conjunta exige fotografia completa das revisões';
  END IF;
  IF jsonb_typeof(v_evento->'encontrosIds') IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_evento->'horarios') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Aplicação conjunta exige listas explícitas de encontros e horários';
  END IF;

  SELECT count(*) INTO v_total
    FROM jsonb_array_elements(v_snapshot->'revisoes') t
    CROSS JOIN LATERAL jsonb_array_elements(t->'previsao'->'propostas') p
    WHERE (p->>'alterado')::boolean;
  SELECT jsonb_array_length(v_evento->'horarios') INTO v_evento_total;
  SELECT jsonb_array_length(v_evento->'encontrosIds') INTO v_ids_total;

  IF v_total IS DISTINCT FROM v_evento_total
    OR v_total IS DISTINCT FROM v_ids_total
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_evento->'encontrosIds') i GROUP BY i HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_evento->'horarios') h GROUP BY h->>'encontroId' HAVING count(*) > 1)
    OR EXISTS (
      SELECT 1
        FROM jsonb_array_elements(v_snapshot->'revisoes') t
        CROSS JOIN LATERAL jsonb_array_elements(t->'previsao'->'propostas') p
        WHERE (p->>'alterado')::boolean
          AND (
            NOT (v_evento->'encontrosIds' ? (p->>'encontroId'))
            OR NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(v_evento->'horarios') h
                WHERE h->>'encontroId' = p->>'encontroId'
                  AND h->>'inicioProposto' = p->>'inicioProposto'
                  AND h->>'fimProposto' = p->>'fimProposto'
            )
            OR NOT EXISTS (
              SELECT 1 FROM "EncontroAgenda" a
                WHERE a.id = p->>'encontroId'
                  AND a.inicio = ((p->>'inicioProposto')::timestamptz AT TIME ZONE 'UTC')
                  AND a.fim = ((p->>'fimProposto')::timestamptz AT TIME ZONE 'UTC')
            )
          )
    ) THEN
    RAISE EXCEPTION 'Aplicação conjunta sem os encontros materiais da revisão';
  END IF;
  RETURN NULL;
END $$;
