-- A atribuição de segunda chamada vale no intervalo inteiro [inicio,fim).
-- A última designação conhecida continua prevalecendo, inclusive quando uma
-- versão expirada impede o retorno implícito à versão anterior.
CREATE FUNCTION professor_segunda_chamada_cobre_intervalo(
  proposta_id TEXT,
  professor_id TEXT,
  inicio_intervalo TIMESTAMP,
  fim_intervalo TIMESTAMP
) RETURNS BOOLEAN
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  turma_id TEXT;
BEGIN
  IF proposta_id IS NULL OR professor_id IS NULL
    OR inicio_intervalo IS NULL OR fim_intervalo IS NULL
    OR NOT isfinite(inicio_intervalo) OR NOT isfinite(fim_intervalo)
    OR fim_intervalo <= inicio_intervalo THEN
    RETURN false;
  END IF;

  SELECT "turmaId" INTO turma_id
  FROM "PropostaSegundaChamada"
  WHERE id = proposta_id
  FOR KEY SHARE;
  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM id FROM "Usuario"
  WHERE id = professor_id AND ativo AND 'PROFESSOR' = ANY(papeis)
  FOR SHARE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF EXISTS (
    WITH pontos(instante) AS (
      SELECT inicio_intervalo
      UNION SELECT fim_intervalo
      UNION
      SELECT d.inicio
      FROM "DesignacaoSegundaChamada" d
      WHERE d."propostaId" = proposta_id
        AND d.inicio > inicio_intervalo AND d.inicio < fim_intervalo
      UNION
      SELECT d.fim
      FROM "DesignacaoSegundaChamada" d
      WHERE d."propostaId" = proposta_id AND d.fim IS NOT NULL
        AND d.fim > inicio_intervalo AND d.fim < fim_intervalo
      UNION
      SELECT d."criadaEm"
      FROM "DesignacaoSegundaChamada" d
      WHERE d."propostaId" = proposta_id
        AND d."criadaEm" > inicio_intervalo AND d."criadaEm" < fim_intervalo
      UNION
      SELECT v.inicio
      FROM "VinculoDocente" v
      WHERE v."turmaId" = turma_id AND v."professorId" = professor_id
        AND v.inicio > inicio_intervalo AND v.inicio < fim_intervalo
      UNION
      SELECT v.fim
      FROM "VinculoDocente" v
      WHERE v."turmaId" = turma_id AND v."professorId" = professor_id AND v.fim IS NOT NULL
        AND v.fim > inicio_intervalo AND v.fim < fim_intervalo
    ), faixas AS (
      SELECT instante, lead(instante) OVER (ORDER BY instante) AS fim
      FROM pontos
    )
    SELECT 1
    FROM faixas faixa
    WHERE faixa.fim IS NOT NULL AND faixa.fim > faixa.instante
      AND NOT (
        EXISTS (
          SELECT 1
          FROM "VinculoDocente" v
          WHERE v."turmaId" = turma_id
            AND v."professorId" = professor_id
            AND v.inicio <= faixa.instante
            AND (v.fim IS NULL OR v.fim >= faixa.fim)
        )
        OR professor_segunda_chamada_no_instante(proposta_id, faixa.instante) IS NOT DISTINCT FROM professor_id
      )
  ) THEN
    RETURN false;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION "guard_agenda_segunda_chamada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reserva record;
  fonte record;
  encontro record;
  usuario record;
  prazo TIMESTAMP;
  agora TIMESTAMP;
BEGIN
  SELECT rs.*, p."turmaId", p."alocacaoId"
  INTO reserva
  FROM "ReservaSegundaChamada" rs
  JOIN "PropostaSegundaChamada" p ON p.id = rs."propostaId"
  WHERE rs.id = NEW."reservaId"
  FOR UPDATE OF rs;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agenda exige reserva de segunda chamada existente'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));

  SELECT p.id, p."matriculaId", p."turmaId", p."alocacaoId", p."regraId", p."codigoAvaliacao",
    d.aprovada AS decisao_aprovada, disp.id AS disponibilizacao_id,
    COALESCE((
      SELECT pr."novoPrazo"
      FROM "PropostaProrrogacaoSegundaChamada" pr
      JOIN "DecisaoProrrogacaoSegundaChamada" dp ON dp."propostaId" = pr.id AND dp.aprovada
      WHERE pr."disponibilizacaoId" = disp.id
      ORDER BY pr.versao DESC
      LIMIT 1
    ), disp."prazoAte") AS prazo
  INTO fonte
  FROM "PropostaSegundaChamada" p
  LEFT JOIN "DecisaoSegundaChamada" d ON d."propostaId" = p.id
  LEFT JOIN "DisponibilizacaoSegundaChamada" disp ON disp."propostaId" = p.id
  WHERE p.id = reserva."propostaId"
  FOR KEY SHARE OF p;
  IF NOT FOUND
    OR fonte.decisao_aprovada IS DISTINCT FROM true
    OR fonte.disponibilizacao_id IS NULL
    OR (fonte."matriculaId", fonte."turmaId", fonte."alocacaoId", fonte."regraId", fonte."codigoAvaliacao")
       IS DISTINCT FROM (reserva."matriculaId", reserva."turmaId", reserva."alocacaoId", reserva."regraId", reserva."codigoAvaliacao") THEN
    RAISE EXCEPTION 'Agenda exige proposta aprovada e disponibilizada no contexto exato';
  END IF;
  prazo := fonte.prazo;

  SELECT id, "matriculaId", "turmaId", "professorId", inicio, fim, status, finalidade
  INTO encontro
  FROM "EncontroAgenda"
  WHERE id = NEW."encontroId"
  FOR KEY SHARE;
  IF NOT FOUND
    OR encontro.finalidade <> 'SEGUNDA_CHAMADA'
    OR encontro.status <> 'PREVISTO'
    OR encontro."matriculaId" IS DISTINCT FROM reserva."matriculaId"
    OR encontro."turmaId" IS DISTINCT FROM reserva."turmaId" THEN
    RAISE EXCEPTION 'Agenda exige encontro SEGUNDA_CHAMADA previsto do vínculo exato';
  END IF;

  agora := clock_timestamp() AT TIME ZONE 'UTC';
  IF NOT isfinite(encontro.inicio) OR NOT isfinite(encontro.fim)
    OR encontro.fim <= encontro.inicio
    OR encontro.inicio <= agora
    OR prazo IS NULL OR NOT isfinite(prazo)
    OR encontro.fim > prazo THEN
    RAISE EXCEPTION 'Agenda exige encontro futuro, ordenado e integralmente dentro do prazo vigente';
  END IF;

  IF encontro."professorId" IS NULL THEN RAISE EXCEPTION 'Agenda exige professor identificado'; END IF;
  SELECT ativo, papeis INTO usuario
  FROM "Usuario" WHERE id = encontro."professorId" FOR SHARE;
  IF NOT FOUND OR NOT usuario.ativo OR NOT ('PROFESSOR' = ANY(usuario.papeis)) THEN
    RAISE EXCEPTION 'Professor da agenda precisa estar ativo';
  END IF;
  IF NOT professor_segunda_chamada_cobre_intervalo(
    reserva."propostaId", encontro."professorId", encontro.inicio, encontro.fim
  ) THEN
    RAISE EXCEPTION 'Professor sem vínculo ou designação durante todo o intervalo da segunda chamada';
  END IF;
  RETURN NEW;
END $$;
