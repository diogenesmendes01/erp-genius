-- Q117/Q38: uma aplicação de agenda aponta para o único evento que a publicou.
-- Eventos com o mesmo payload não são fonte material da aplicação.
ALTER TABLE "AplicacaoAgendaAditivoParticular" ADD COLUMN "eventoId" TEXT;

-- Migração de fatos já aplicados: não escolhe arbitrariamente um clone.
DO $$
BEGIN
  IF EXISTS (
    WITH candidatos AS (
      SELECT aa.id, count(e.id) AS total
      FROM "AplicacaoAgendaAditivoParticular" aa
      JOIN "AplicacaoCondicoesAditivo" ac ON ac.id=aa."aplicacaoCondicoesId"
      JOIN "VersaoCondicoesAditivo" vc ON vc.id=ac."versaoCondicoesId"
      LEFT JOIN "Evento" e ON e.tipo='CondicoesAditivoAplicadas'
        AND e."agregadoTipo"='Matricula' AND e."agregadoId"=aa."matriculaId"
        AND e."autorId"=aa."aplicadorId"
        AND e.payload->>'aplicacaoAgendaId'=aa.id
        AND e.payload->>'aplicacaoId'=ac.id
        AND e.payload->>'propostaAgendaId'=aa."propostaId"
        AND e.payload->>'propostaId'=ac."propostaId"
        AND e.payload->>'versao'=vc.versao::text
        AND e.payload->>'condicoesHash'=ac."condicoesHash"
      GROUP BY aa.id
    ) SELECT 1 FROM candidatos WHERE total <> 1
  ) THEN
    RAISE EXCEPTION 'Aplicação de agenda exige exatamente um evento canônico para migrar';
  END IF;
END $$;

-- O guard 201 conserva a aplicação imutável. Só esta atualização de backfill
-- precisa suspendê-lo; a transação restaura o trigger antes de criar a guarda nova.
ALTER TABLE "AplicacaoAgendaAditivoParticular" DISABLE TRIGGER validar_aplicacao_agenda_aditivo_117;

WITH candidatos AS (
  SELECT aa.id AS aplicacao_id, min(e.id) AS evento_id
  FROM "AplicacaoAgendaAditivoParticular" aa
  JOIN "AplicacaoCondicoesAditivo" ac ON ac.id=aa."aplicacaoCondicoesId"
  JOIN "VersaoCondicoesAditivo" vc ON vc.id=ac."versaoCondicoesId"
  JOIN "Evento" e ON e.tipo='CondicoesAditivoAplicadas'
    AND e."agregadoTipo"='Matricula' AND e."agregadoId"=aa."matriculaId"
    AND e."autorId"=aa."aplicadorId"
    AND e.payload->>'aplicacaoAgendaId'=aa.id
    AND e.payload->>'aplicacaoId'=ac.id
    AND e.payload->>'propostaAgendaId'=aa."propostaId"
    AND e.payload->>'propostaId'=ac."propostaId"
    AND e.payload->>'versao'=vc.versao::text
    AND e.payload->>'condicoesHash'=ac."condicoesHash"
  GROUP BY aa.id
  HAVING count(*)=1
)
UPDATE "AplicacaoAgendaAditivoParticular" aa
SET "eventoId"=candidatos.evento_id
FROM candidatos
WHERE aa.id=candidatos.aplicacao_id;

ALTER TABLE "AplicacaoAgendaAditivoParticular" ENABLE TRIGGER validar_aplicacao_agenda_aditivo_117;

ALTER TABLE "AplicacaoAgendaAditivoParticular" ALTER COLUMN "eventoId" SET NOT NULL;
CREATE UNIQUE INDEX "AplicacaoAgendaAditivoParticular_eventoId_key" ON "AplicacaoAgendaAditivoParticular"("eventoId");
ALTER TABLE "AplicacaoAgendaAditivoParticular" ADD CONSTRAINT "AplicacaoAgendaAditivoParticular_eventoId_fkey"
  FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION "agenda_aditivo_aviso_valido"(evento_id text, matricula_id text)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
BEGIN
 RETURN EXISTS (
  SELECT 1 FROM "Evento" e
  JOIN "AplicacaoAgendaAditivoParticular" aa ON aa.id=e.payload->>'aplicacaoAgendaId'
    AND aa."eventoId"=e.id AND aa."matriculaId"=matricula_id AND e."autorId"=aa."aplicadorId"
  JOIN "AplicacaoCondicoesAditivo" ac ON ac.id=aa."aplicacaoCondicoesId" AND ac.id=e.payload->>'aplicacaoId' AND ac."matriculaId"=matricula_id AND ac."propostaId"=e.payload->>'propostaId' AND ac."condicoesHash"=e.payload->>'condicoesHash'
  JOIN "VersaoCondicoesAditivo" vc ON vc.id=ac."versaoCondicoesId" AND vc."condicoesHash"=ac."condicoesHash" AND vc.versao::text=e.payload->>'versao'
  JOIN "PropostaAgendaAditivoParticular" pa ON pa.id=aa."propostaId" AND pa.id=e.payload->>'propostaAgendaId' AND pa."matriculaId"=matricula_id AND aa."fotografiaHash"=pa."fotografiaHash"
  WHERE e.id=evento_id AND e.tipo='CondicoesAditivoAplicadas' AND e."agregadoTipo"='Matricula' AND e."agregadoId"=matricula_id
    AND e.payload ? 'aplicacaoAgendaId' AND e.payload ? 'aplicacaoId' AND e.payload ? 'propostaAgendaId' AND e.payload ? 'propostaId'
 );
END $$;

-- Complementa a guarda 201: a FK prova a existência do Evento e esta cadeia
-- deferred prova que ele é o fato exato da aplicação, não um clone compatível.
CREATE FUNCTION exigir_evento_aplicacao_agenda_aditivo_205() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "Evento" e
    JOIN "AplicacaoCondicoesAditivo" ac ON ac.id=NEW."aplicacaoCondicoesId"
    JOIN "VersaoCondicoesAditivo" vc ON vc.id=ac."versaoCondicoesId"
    JOIN "PropostaAgendaAditivoParticular" pa ON pa.id=NEW."propostaId"
    WHERE e.id=NEW."eventoId"
      AND e.tipo='CondicoesAditivoAplicadas'
      AND e."agregadoTipo"='Matricula' AND e."agregadoId"=NEW."matriculaId"
      AND e."autorId"=NEW."aplicadorId"
      AND e.payload->>'aplicacaoAgendaId'=NEW.id
      AND e.payload->>'aplicacaoId'=ac.id
      AND e.payload->>'propostaAgendaId'=NEW."propostaId"
      AND e.payload->>'propostaId'=ac."propostaId"
      AND e.payload->>'versao'=vc.versao::text
      AND e.payload->>'condicoesHash'=ac."condicoesHash"
      AND NEW."fotografiaHash"=pa."fotografiaHash"
  ) THEN RAISE EXCEPTION 'Evento canônico não corresponde à aplicação de agenda'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER exigir_evento_aplicacao_agenda_aditivo_205
AFTER INSERT ON "AplicacaoAgendaAditivoParticular" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION exigir_evento_aplicacao_agenda_aditivo_205();
