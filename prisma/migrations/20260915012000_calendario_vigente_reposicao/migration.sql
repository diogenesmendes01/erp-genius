-- Q20/Q45: períodos não letivos pertencem somente à última versão aprovada.
-- Substituição pontual preserva os demais guards, inclusive evoluções do ciclo 185.
DO $patch$
DECLARE definicao TEXT; anterior TEXT := $anterior$SELECT EXISTS (SELECT 1 FROM "VersaoCalendarioEscolar" v JOIN "DecisaoCalendarioEscolar" d ON d."calendarioId"=v.id AND d.aprovada CROSS JOIN LATERAL jsonb_to_recordset(v.periodos) AS p(id TEXT, inicio DATE, fim DATE) WHERE p.inicio <= (((e.fim - interval '1 millisecond') AT TIME ZONE 'UTC') AT TIME ZONE v."fusoInstitucional")::date AND p.fim >= data_agendada) INTO periodo_nao_letivo;$anterior$;
BEGIN
  SELECT pg_get_functiondef('validar_agenda_reposicao_individual()'::regprocedure) INTO definicao;
  IF strpos(definicao, anterior) > 0 THEN
    EXECUTE replace(definicao, anterior, $novo$SELECT EXISTS (
    SELECT 1 FROM (
      SELECT v.* FROM "VersaoCalendarioEscolar" v
      JOIN "DecisaoCalendarioEscolar" d ON d."calendarioId" = v.id AND d.aprovada
      ORDER BY v.versao DESC LIMIT 1
    ) v
    CROSS JOIN LATERAL jsonb_to_recordset(v.periodos) AS p(id TEXT, inicio DATE, fim DATE)
    WHERE p.inicio <= (((e.fim - interval '1 millisecond') AT TIME ZONE 'UTC') AT TIME ZONE v."fusoInstitucional")::date
      AND p.fim >= ((e.inicio AT TIME ZONE 'UTC') AT TIME ZONE v."fusoInstitucional")::date
  ) INTO periodo_nao_letivo;$novo$);
  ELSIF definicao !~ 'ORDER BY v[.]versao DESC LIMIT 1' THEN
    RAISE EXCEPTION 'Guard de agenda inesperado: conferir seleção da versão do calendário';
  END IF;
END $patch$;
