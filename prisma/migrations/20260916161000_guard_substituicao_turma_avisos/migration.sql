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
          AND evento.tipo = 'SubstituicaoDocenteDecidida'
          AND encontro."turmaId" IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM "AlocacaoTurma" alocacao
            WHERE alocacao."turmaId" = encontro."turmaId"
              AND alocacao."matriculaId" = aviso."matriculaId"
              AND alocacao."criadoEm" <= encontro.inicio
              AND (alocacao."encerradaEm" IS NULL OR alocacao."encerradaEm" > encontro.inicio)
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Item não pertence à alteração aplicada';
  END IF;
  RETURN NEW;
END $$;
