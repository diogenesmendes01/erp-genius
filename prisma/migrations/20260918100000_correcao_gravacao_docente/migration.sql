-- Q23: a proposta de nova fonte da publicação pode ser preparada pelo docente
-- ainda responsável pela aula. A decisão continua exclusivamente institucional.
CREATE OR REPLACE FUNCTION validar_proposta_regularizacao_fonte_gravacao_149() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.alvo = 'PUBLICACAO_AULA' THEN
    -- Mantém a mesma ordem da correção de aula: calendário, encontro, usuário.
    PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
    PERFORM 1
      FROM "PublicacaoGravacaoAula" p
      JOIN "EncontroAgenda" e ON e.id = p."encontroId"
      WHERE p.id = NEW."publicacaoAulaId"
      FOR SHARE OF e;
    IF NOT FOUND THEN RAISE EXCEPTION 'Publicação da fonte não encontrada'; END IF;
  END IF;

  PERFORM 1 FROM "Usuario" WHERE id = NEW."preparadorId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preparador não encontrado'; END IF;

  IF NEW.alvo = 'MATERIAL_REPOSICAO' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Usuario" u
      WHERE u.id = NEW."preparadorId" AND u.ativo
        AND ('GERENTE_PEDAGOGICO'::"Papel" = ANY(u.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(u.papeis))
    ) THEN RAISE EXCEPTION 'Material exige preparador de gestão ativo'; END IF;
    RETURN NEW;
  END IF;

  -- Preserva integralmente o preparo institucional anterior, sem exigir diário.
  IF EXISTS (
    SELECT 1 FROM "Usuario" u
    WHERE u.id = NEW."preparadorId" AND u.ativo
      AND ('GERENTE_PEDAGOGICO'::"Papel" = ANY(u.papeis) OR 'ADMINISTRADOR'::"Papel" = ANY(u.papeis))
  ) THEN RETURN NEW; END IF;

  -- Somente o docente responsável por uma aula já ministrada, coerente com o
  -- diário e ainda com vínculo vigente pode preparar a correção desta publicação.
  IF NOT EXISTS (
    SELECT 1
    FROM "Usuario" u
    JOIN "PublicacaoGravacaoAula" p ON p.id = NEW."publicacaoAulaId"
    JOIN "EncontroAgenda" e ON e.id = p."encontroId"
    JOIN "AulaDiario" d ON d."encontroId" = e.id
    WHERE u.id = NEW."preparadorId" AND u.ativo
      AND 'PROFESSOR'::"Papel" = ANY(u.papeis)
      AND e."professorId" = u.id
      AND e.finalidade = 'AULA'
      AND e.status = 'MINISTRADO'
      AND e.fim <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      AND d."professorId" = e."professorId"
      AND d."turmaId" IS NOT DISTINCT FROM e."turmaId"
      AND d."ocorridaEm" = e.inicio
      AND (
        (e."turmaId" IS NULL AND e."matriculaId" IS NOT NULL)
        OR EXISTS (
          SELECT 1 FROM "Turma" t
          JOIN "VinculoDocente" v ON v."turmaId" = t.id
          WHERE t.id = e."turmaId" AND t."professorId" = u.id
            AND v."professorId" = u.id AND v.fim IS NULL
            AND v.inicio <= e.inicio
            AND v.inicio <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        )
      )
  ) THEN RAISE EXCEPTION 'Preparador sem gestão ativa ou vínculo docente vigente da aula'; END IF;
  RETURN NEW;
END; $$;