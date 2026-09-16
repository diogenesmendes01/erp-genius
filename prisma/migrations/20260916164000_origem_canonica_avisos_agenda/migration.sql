CREATE OR REPLACE FUNCTION "guard_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."eventoId" IS NULL OR NEW."matriculaId" IS NULL OR NEW.situacao <> 'PREPARADO'::"SituacaoAvisoAlteracaoAgenda" THEN RAISE EXCEPTION 'Aviso exige origem aplicada e estado PREPARADO'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "Evento" e
      WHERE e.id = NEW."eventoId" AND e.payload->>'aprovada' = 'true'
        AND (
          (e."agregadoTipo" = 'Matricula' AND e."agregadoId" = NEW."matriculaId" AND e.tipo IN ('RemarcacaoParticularDecidida','RemarcacaoAgendaReposicaoDecidida') AND e.payload ? 'encontroOriginalId' AND e.payload ? 'encontroNovoId' AND e.payload->>'encontroNovoId' IS NOT NULL)
          OR (e."agregadoTipo" = 'ConfiguracaoOperacional' AND e."agregadoId" = 'escola' AND e.tipo = 'SubstituicaoDocenteDecidida' AND e.payload ? 'encontrosIds')
        )
    ) THEN RAISE EXCEPTION 'Origem do aviso inválida'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Matricula" m WHERE m.id = NEW."matriculaId" AND m."alunoId" = NEW."alunoId") THEN RAISE EXCEPTION 'Matrícula do aviso incompatível'; END IF;
  ELSE
    IF NEW."eventoId" IS DISTINCT FROM OLD."eventoId" OR NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId" OR NEW."alunoId" <> OLD."alunoId" OR NEW.canal <> OLD.canal OR NEW."contatoHash" <> OLD."contatoHash" OR NEW.chave <> OLD.chave OR NEW."mudancaId" <> OLD."mudancaId" OR NEW."criadoEm" <> OLD."criadoEm" THEN RAISE EXCEPTION 'Origem do aviso é imutável'; END IF;
    IF NOT ((OLD.situacao = 'PREPARADO' AND NEW.situacao IN ('INCERTO','FALHOU')) OR (OLD.situacao = 'INCERTO' AND NEW.situacao IN ('ENVIADO','FALHOU'))) AND NEW.situacao <> OLD.situacao THEN RAISE EXCEPTION 'Transição de aviso inválida'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_item_aviso_alteracao_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "AvisoAlteracaoAgenda" aviso
    JOIN "EncontroAgenda" encontro ON encontro.id = NEW."encontroId"
    JOIN "Evento" evento ON evento.id = aviso."eventoId"
    WHERE aviso.id = NEW."avisoId"
      AND aviso.situacao = 'PREPARADO'
      AND (evento.payload->'encontrosIds' ? NEW."encontroId" OR NEW."encontroId" IN (evento.payload->>'encontroOriginalId', evento.payload->>'encontroNovoId'))
      AND (
        encontro."matriculaId" = aviso."matriculaId"
        OR (
          evento."agregadoTipo" = 'ConfiguracaoOperacional'
          AND evento."agregadoId" = 'escola'
          AND evento.tipo = 'SubstituicaoDocenteDecidida'
          AND encontro."turmaId" IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM "AlocacaoTurma" alocacao
            WHERE alocacao."turmaId" = encontro."turmaId"
              AND alocacao."matriculaId" = aviso."matriculaId"
              AND alocacao."criadoEm" <= encontro.inicio
              AND (alocacao."encerradaEm" IS NULL OR alocacao."encerradaEm" > encontro.inicio)
          )
        )
      )
  ) THEN RAISE EXCEPTION 'Item não pertence à alteração aplicada'; END IF;
  RETURN NEW;
END $$;
