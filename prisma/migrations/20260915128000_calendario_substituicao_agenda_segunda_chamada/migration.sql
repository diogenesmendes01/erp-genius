-- Q20: uma nova proposta pode conferir outra versão do calendário quando as
-- condições do encontro continuam iguais. A decisão compara o snapshot integral
-- e recusa qualquer alteração posterior à proposta, mesmo sem impacto no horário.
CREATE OR REPLACE FUNCTION conferir_proposta_substituicao_agenda_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE estado JSONB; agora TIMESTAMP;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Proposta de substituição de segunda chamada é imutável'; END IF;
 PERFORM 1 FROM "ReservaSegundaChamada" WHERE id=NEW."reservaId" FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Substituição exige reserva existente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 estado:=estado_substituicao_agenda_segunda_chamada(NEW."reservaId",NEW."substitutoId"); agora:=clock_timestamp() AT TIME ZONE 'UTC';
 IF estado IS NULL OR NEW.snapshot IS DISTINCT FROM estado OR NEW."encontroId" IS DISTINCT FROM estado#>>'{encontro,id}'
    OR estado#>>'{reserva,status}'<>'RESERVADA' OR estado#>>'{encontro,finalidade}'<>'SEGUNDA_CHAMADA' OR estado#>>'{encontro,status}'<>'PREVISTO'
    OR estado#>'{fatos,ocorrencia}' IS DISTINCT FROM 'null'::jsonb OR estado#>'{fatos,realizacao}' IS DISTINCT FROM 'null'::jsonb
    OR (estado#>>'{encontro,inicio}')::timestamp<=agora OR estado#>>'{calendarioFonte,calendarioId}' IS NULL
    OR estado#>>'{calendarioAtual,calendarioId}' IS NULL
    OR estado#>>'{calendarioFonte,fusoInstitucional}' IS DISTINCT FROM estado#>>'{calendarioAtual,fusoInstitucional}'
    OR estado#>'{calendarioFonte,periodosNaoLetivos}' IS DISTINCT FROM estado#>'{calendarioAtual,periodosNaoLetivos}' THEN RAISE EXCEPTION 'Agenda, calendário ou fonte da substituição mudou'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."autorId" AND ativo AND papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[] FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Substituição exige equipe ativa'; END IF;
 PERFORM id FROM "Usuario" WHERE id=NEW."substitutoId" AND ativo AND 'PROFESSOR'=ANY(papeis) FOR SHARE; IF NOT FOUND OR NEW."substitutoId"=estado#>>'{encontro,professorId}' THEN RAISE EXCEPTION 'Substituto precisa ser professor ativo distinto'; END IF;

 IF NEW.versao<>COALESCE((SELECT max(versao) FROM "PropostaSubstituicaoAgendaSegundaChamada" WHERE "reservaId"=NEW."reservaId"),0)+1 THEN RAISE EXCEPTION 'Versão de substituição desatualizada'; END IF;
 NEW."criadaEm":=agora; RETURN NEW;
END $$;
