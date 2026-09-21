-- Q151: a validade contratual precisa cobrir continuamente [inicio, fim), não
-- apenas seus extremos. Cada fronteira que pode alterar a situação ou a
-- autorização é conferida sob a mesma fonte temporal já usada pelos fatos.
CREATE FUNCTION situacao_autorizacao_segunda_chamada_cobre_intervalo(
  matricula_id TEXT, alocacao_id TEXT, codigo_avaliacao TEXT,
  inicio TIMESTAMP, fim TIMESTAMP
) RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  ativada_em TIMESTAMP;
  limite_vinculo TIMESTAMP;
  alocacao_ativa BOOLEAN;
  ponto RECORD;
  situacao TEXT;
BEGIN
  IF matricula_id IS NULL OR alocacao_id IS NULL OR codigo_avaliacao IS NULL
     OR inicio IS NULL OR fim IS NULL OR NOT isfinite(inicio) OR NOT isfinite(fim)
     OR inicio >= fim THEN
    RETURN false;
  END IF;

  SELECT m."ativadaEm", e."limiteVinculo", a.ativa
    INTO ativada_em, limite_vinculo, alocacao_ativa
    FROM "Matricula" m
    JOIN "AlocacaoTurma" a ON a.id=alocacao_id AND a."matriculaId"=m.id
    LEFT JOIN "RegistroEncerramentoMatricula" e ON e."matriculaId"=m.id
    WHERE m.id=matricula_id;
  IF NOT FOUND OR ativada_em IS NULL OR NOT isfinite(ativada_em)
     OR (limite_vinculo IS NOT NULL AND NOT isfinite(limite_vinculo)) THEN
    RETURN false;
  END IF;

  FOR ponto IN
    SELECT DISTINCT pontos.instante
      FROM (
        SELECT v.instante FROM (VALUES (inicio),(fim-interval '1 millisecond'),(ativada_em),(limite_vinculo)) v(instante)
        UNION ALL
        SELECT ((pp.snapshot->>'dataEfetiva')::date::timestamp AT TIME ZONE (pp.snapshot->>'fusoInstitucional')) AT TIME ZONE 'UTC'
          FROM "ItemPropostaPausa" ip
          JOIN "PropostaPausaMatriculas" pp ON pp.id=ip."propostaId"
          WHERE ip."matriculaId"=matricula_id AND pp.status='APLICADA'
        UNION ALL
        SELECT ((pr.snapshot->>'retorno')::date::timestamp AT TIME ZONE (pr.snapshot->>'fusoInstitucional')) AT TIME ZONE 'UTC'
          FROM "ItemPropostaRetomadaMatriculas" ir
          JOIN "PropostaRetomadaMatriculas" pr ON pr.id=ir."propostaId"
          WHERE ir."matriculaId"=matricula_id AND pr.status='APLICADA'
        UNION ALL
        SELECT ae."criadaEm"
          FROM "AutorizacaoEspecialSegundaChamada" ae
          WHERE ae."alocacaoId"=alocacao_id AND ae."codigoAvaliacao"=codigo_avaliacao
        UNION ALL
        SELECT ae."prazoAte"+interval '1 millisecond'
          FROM "AutorizacaoEspecialSegundaChamada" ae
          WHERE ae."alocacaoId"=alocacao_id AND ae."codigoAvaliacao"=codigo_avaliacao
      ) pontos
      WHERE pontos.instante IS NOT NULL AND isfinite(pontos.instante)
        AND pontos.instante>=inicio AND pontos.instante<fim
      ORDER BY instante
  LOOP
    situacao:=situacao_matricula_no_instante(matricula_id,ponto.instante);
    IF situacao='ATIVA' THEN
      IF alocacao_ativa IS NOT TRUE THEN RETURN false; END IF;
    ELSIF situacao IN ('PAUSADA','ENCERRADA') THEN
      IF NOT autorizacao_especial_segunda_chamada_valida(alocacao_id,codigo_avaliacao,ponto.instante) THEN RETURN false; END IF;
    ELSE
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END $$;
-- Q151: valida a autorização contratual no intervalo completo de remarcação.
CREATE OR REPLACE FUNCTION aplicar_remarcacao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "ReservaSegundaChamada"%ROWTYPE; p "PropostaRemarcacaoAgendaSegundaChamada"%ROWTYPE; a "AgendaSegundaChamada"%ROWTYPE; e "EncontroAgenda"%ROWTYPE; fonte "PropostaSegundaChamada"%ROWTYPE; novo TEXT; agora TIMESTAMP;
BEGIN
 IF NOT NEW.aprovada THEN RETURN NEW; END IF;
 SELECT p0."reservaId" INTO r.id FROM "PropostaRemarcacaoAgendaSegundaChamada" p0 WHERE p0.id=NEW."propostaId";
 SELECT * INTO r FROM "ReservaSegundaChamada" WHERE id=r.id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Remarcação aprovada exige reserva existente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 SELECT * INTO p FROM "PropostaRemarcacaoAgendaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 SELECT * INTO fonte FROM "PropostaSegundaChamada" WHERE id=r."propostaId" FOR UPDATE;
 SELECT * INTO a FROM "AgendaSegundaChamada" WHERE "reservaId"=r.id FOR UPDATE;
 SELECT * INTO e FROM "EncontroAgenda" WHERE id=a."encontroId" FOR UPDATE;
 agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF NOT situacao_autorizacao_segunda_chamada_cobre_intervalo(fonte."matriculaId",fonte."alocacaoId",fonte."codigoAvaliacao",p.inicio,p.fim) THEN RAISE EXCEPTION 'Situação contratual não permite todo o intervalo da remarcação'; END IF;
 IF r.status<>'RESERVADA' OR p.snapshot IS DISTINCT FROM estado_remarcacao_agenda_segunda_chamada(r.id) OR e.status<>'PREVISTO' OR e.finalidade<>'SEGUNDA_CHAMADA' OR p.inicio<=agora OR EXISTS(SELECT 1 FROM "OcorrenciaSegundaChamada" WHERE "reservaId"=r.id) OR EXISTS(SELECT 1 FROM "RealizacaoSegundaChamada" WHERE "reservaId"=r.id) THEN RAISE EXCEPTION 'A agenda mudou antes da remarcação aprovada'; END IF;
 novo:='remarcacao-segunda:'||NEW.id;
 INSERT INTO "EncontroAgenda" (id,"turmaId","matriculaId","professorId","preparadorId",inicio,fim,"fusoOrigem",status,motivo,"chaveIdempotencia","entradaHash",finalidade,"criadoEm") VALUES (novo,e."turmaId",e."matriculaId",e."professorId",NEW."decisorId",p.inicio,p.fim,p."fusoOrigem",'PREVISTO',p.motivo,'remarcacao-segunda:'||NEW.id,p."entradaHash",'SEGUNDA_CHAMADA',agora);
 INSERT INTO "AplicacaoRemarcacaoAgendaSegundaChamada" (id,"decisaoId","encontroOriginalId","encontroNovoId","aplicadaEm") VALUES ('aplicacao-remarcacao-segunda:'||NEW.id,NEW.id,e.id,novo,agora);
 UPDATE "DecisaoRemarcacaoAgendaSegundaChamada" SET "encontroNovoId"=novo WHERE id=NEW.id AND "encontroNovoId" IS NULL;
 UPDATE "EncontroAgenda" SET status='CANCELADO' WHERE id=e.id AND status='PREVISTO'; IF NOT FOUND THEN RAISE EXCEPTION 'Encontro anterior mudou antes da remarcação'; END IF;
 UPDATE "AgendaSegundaChamada" SET "encontroId"=novo WHERE id=a.id AND "encontroId"=e.id; IF NOT FOUND THEN RAISE EXCEPTION 'Agenda mudou antes da remarcação'; END IF;
 RETURN NEW;
END $$;
