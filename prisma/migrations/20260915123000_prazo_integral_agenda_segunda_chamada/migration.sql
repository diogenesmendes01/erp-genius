-- Q149: o encontro ligado à reserva deve caber integralmente no prazo vigente.
-- Mantém o guard de contexto/docente de 107 e a ordem reserva -> calendário
-- -> proposta/agenda/encontro usada pelos demais fluxos de segunda chamada.
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agenda exige reserva de segunda chamada existente';
  END IF;

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

  IF encontro."professorId" IS NULL THEN
    RAISE EXCEPTION 'Agenda exige professor identificado';
  END IF;
  SELECT ativo, papeis INTO usuario
  FROM "Usuario" WHERE id = encontro."professorId" FOR SHARE;
  IF NOT FOUND OR NOT usuario.ativo OR NOT ('PROFESSOR' = ANY(usuario.papeis)) THEN
    RAISE EXCEPTION 'Professor da agenda precisa estar ativo';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "VinculoDocente" v
    WHERE v."turmaId" = encontro."turmaId"
      AND v."professorId" = encontro."professorId"
      AND v.inicio <= encontro.inicio
      AND (v.fim IS NULL OR v.fim > encontro.inicio)
  ) AND professor_segunda_chamada_no_instante(reserva."propostaId", encontro.inicio)
      IS DISTINCT FROM encontro."professorId" THEN
    RAISE EXCEPTION 'Professor sem escopo para segunda chamada';
  END IF;
  RETURN NEW;
END $$;
