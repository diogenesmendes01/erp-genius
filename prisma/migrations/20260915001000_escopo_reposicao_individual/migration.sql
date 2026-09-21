-- Fecha o escopo contratual da reposição antes de qualquer conclusão. A guarda
-- de diário/conclusão permanece na migration 176 para não disputar o mesmo trigger.
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
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_decisao_reposicao_individual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pedido "ReposicaoIndividual"%ROWTYPE; origem "EncontroAgenda"%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('reposicao-individual',0));
 SELECT * INTO pedido FROM "ReposicaoIndividual" WHERE id=NEW."reposicaoId";
 IF pedido.id IS NULL THEN RAISE EXCEPTION 'Pedido de reposição não encontrado'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."decisorId" AND ativo
   AND papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decisão de reposição exige gestão ativa'; END IF;
 IF pedido."solicitanteId"=NEW."decisorId" THEN RAISE EXCEPTION 'Solicitante não pode decidir a própria reposição'; END IF;
 PERFORM id FROM "Matricula" WHERE id=pedido."matriculaId" AND status='ATIVA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'A matrícula da reposição não está ativa'; END IF;
 SELECT * INTO origem FROM "EncontroAgenda" WHERE id=pedido."aulaOriginalId" FOR SHARE;
 IF origem.id IS NULL OR origem.finalidade<>'AULA' OR origem."turmaId" IS NULL OR origem.status<>'MINISTRADO' OR origem.fim >= (clock_timestamp() AT TIME ZONE 'UTC') THEN
  RAISE EXCEPTION 'A aula original não permite decisão de reposição';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM "AulaDiario" diario JOIN "RegistroAulaAluno" registro ON registro."aulaId"=diario.id
  JOIN "Matricula" matricula ON matricula.id=pedido."matriculaId"
  WHERE diario."encontroId"=origem.id AND registro."matriculaId"=pedido."matriculaId"
    AND registro."alunoId"=matricula."alunoId" AND registro.participacao IN ('FALTA','IMPEDIDO_POR_RESTRICAO')
 ) THEN RAISE EXCEPTION 'A ausência original não corresponde à matrícula da reposição'; END IF;
 RETURN NEW;
END $$;
