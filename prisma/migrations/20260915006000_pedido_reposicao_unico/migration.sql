-- Preserva a origem de cada pedido e impede tentativas simultâneas para a mesma ausência.
CREATE OR REPLACE FUNCTION validar_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origem "EncontroAgenda"%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('reposicao-individual',0));
 PERFORM id FROM "Usuario" WHERE id=NEW."solicitanteId" AND ativo
   AND papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de reposição exige solicitante ativo da secretaria ou gestão'; END IF;
 PERFORM id FROM "Matricula" WHERE id=NEW."matriculaId" AND status='ATIVA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Novo pedido de reposição exige matrícula ativa'; END IF;
 SELECT * INTO origem FROM "EncontroAgenda" WHERE id=NEW."aulaOriginalId" FOR SHARE;
 IF origem.id IS NULL OR origem.finalidade<>'AULA' OR origem."turmaId" IS NULL OR origem.status<>'MINISTRADO' OR origem.fim >= (clock_timestamp() AT TIME ZONE 'UTC') THEN
  RAISE EXCEPTION 'Reposição exige aula coletiva ministrada e já encerrada';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM "AulaDiario" diario JOIN "RegistroAulaAluno" registro ON registro."aulaId"=diario.id
  JOIN "Matricula" matricula ON matricula.id=NEW."matriculaId"
  WHERE diario."encontroId"=origem.id AND registro."matriculaId"=NEW."matriculaId"
    AND registro."alunoId"=matricula."alunoId" AND registro.participacao IN ('FALTA','IMPEDIDO_POR_RESTRICAO')
 ) THEN RAISE EXCEPTION 'Reposição exige falta ou impedimento conferido na matrícula exata da aula'; END IF;
 IF EXISTS (
  SELECT 1 FROM "ReposicaoIndividual" anterior
  LEFT JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId"=anterior.id
  LEFT JOIN "AgendaReposicaoIndividual" agenda ON agenda."reposicaoId"=anterior.id
  LEFT JOIN "AulaDiario" diario ON diario."encontroId"=agenda."encontroId"
  LEFT JOIN "RegistroAulaAluno" tentativa ON tentativa."aulaId"=diario.id AND tentativa."matriculaId"=anterior."matriculaId"
  WHERE anterior."matriculaId"=NEW."matriculaId" AND anterior."aulaOriginalId"=NEW."aulaOriginalId"
   AND (decisao.aprovada IS FALSE OR (
    agenda."statusBeneficio"='CONSUMIDA'::"StatusReservaBeneficioReposicao"
    AND tentativa.participacao='FALTA'::"ParticipacaoAula"
    AND NOT EXISTS (SELECT 1 FROM "ConclusaoReposicaoIndividual" c WHERE c."reposicaoId"=anterior.id)
   )) IS NOT TRUE
 ) THEN RAISE EXCEPTION 'A ausência já possui reposição pendente, autorizada ou concluída'; END IF;
 RETURN NEW;
END $$;

