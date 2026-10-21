-- Q40: substituição append-only. A designação original não é atualizada: a
-- nova relação material determina o fim efetivo do seu acesso à reposição.
CREATE TABLE "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" (
  "id" TEXT NOT NULL,
  "reposicaoId" TEXT NOT NULL,
  "designacaoAnteriorId" TEXT NOT NULL,
  "designacaoNovaId" TEXT NOT NULL,
  "designadorId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesignacaoSubstituicaoAvaliadorReposicaoIndividual_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dasari_anterior_key" ON "DesignacaoSubstituicaoAvaliadorReposicaoIndividual"("designacaoAnteriorId");
CREATE UNIQUE INDEX "dasari_nova_key" ON "DesignacaoSubstituicaoAvaliadorReposicaoIndividual"("designacaoNovaId");
CREATE UNIQUE INDEX "dasari_reposicao_chave_key" ON "DesignacaoSubstituicaoAvaliadorReposicaoIndividual"("reposicaoId", "chaveIdempotencia");
CREATE INDEX "dasari_reposicao_criada_idx" ON "DesignacaoSubstituicaoAvaliadorReposicaoIndividual"("reposicaoId", "criadaEm");
ALTER TABLE "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" ADD CONSTRAINT "dasari_reposicao_fkey" FOREIGN KEY ("reposicaoId") REFERENCES "ReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" ADD CONSTRAINT "dasari_anterior_fkey" FOREIGN KEY ("designacaoAnteriorId") REFERENCES "DesignacaoAvaliadorReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" ADD CONSTRAINT "dasari_nova_fkey" FOREIGN KEY ("designacaoNovaId") REFERENCES "DesignacaoAvaliadorReposicaoIndividual"("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" ADD CONSTRAINT "dasari_designador_fkey" FOREIGN KEY ("designadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Toda inserção da cadeia toma a mesma linha da reposição. O constraint
-- deferred protege a forma final; este lock evita write-skew entre transações.
CREATE OR REPLACE FUNCTION bloquear_designacao_avaliador_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "ReposicaoIndividual" WHERE id=NEW."reposicaoId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reposição da designação não encontrada'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bloquear_designacao_avaliador_reposicao_insercao
  BEFORE INSERT ON "DesignacaoAvaliadorReposicaoIndividual" FOR EACH ROW
  EXECUTE FUNCTION bloquear_designacao_avaliador_reposicao();

CREATE OR REPLACE FUNCTION avaliador_reposicao_vigente(reposicao_id TEXT, professor_id TEXT, instante TIMESTAMP(3)) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "DesignacaoAvaliadorReposicaoIndividual" d
    LEFT JOIN "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" s ON s."designacaoAnteriorId"=d.id
    LEFT JOIN "DesignacaoAvaliadorReposicaoIndividual" sucessora ON sucessora.id=s."designacaoNovaId"
    WHERE d."reposicaoId"=reposicao_id AND d."professorId"=professor_id AND d.inicio<=instante
      AND COALESCE(sucessora.inicio, d.fim, 'infinity'::timestamp)>instante
  )
$$;
CREATE OR REPLACE FUNCTION quantidade_avaliadores_reposicao_vigentes(reposicao_id TEXT, instante TIMESTAMP(3)) RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::INTEGER
  FROM "DesignacaoAvaliadorReposicaoIndividual" d
  LEFT JOIN "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" s ON s."designacaoAnteriorId"=d.id
  LEFT JOIN "DesignacaoAvaliadorReposicaoIndividual" sucessora ON sucessora.id=s."designacaoNovaId"
  WHERE d."reposicaoId"=reposicao_id AND d.inicio<=instante
    AND COALESCE(sucessora.inicio, d.fim, 'infinity'::timestamp)>instante
$$;

CREATE OR REPLACE FUNCTION validar_substituicao_avaliador_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE anterior "DesignacaoAvaliadorReposicaoIndividual"%ROWTYPE; nova "DesignacaoAvaliadorReposicaoIndividual"%ROWTYPE;
BEGIN
  PERFORM 1 FROM "ReposicaoIndividual" WHERE id=NEW."reposicaoId" FOR UPDATE;
  SELECT * INTO anterior FROM "DesignacaoAvaliadorReposicaoIndividual" WHERE id=NEW."designacaoAnteriorId" FOR SHARE;
  SELECT * INTO nova FROM "DesignacaoAvaliadorReposicaoIndividual" WHERE id=NEW."designacaoNovaId" FOR SHARE;
  IF anterior.id IS NULL OR nova.id IS NULL OR anterior."reposicaoId"<>NEW."reposicaoId" OR nova."reposicaoId"<>NEW."reposicaoId"
    OR anterior.fim IS NOT NULL OR nova.fim IS NOT NULL OR anterior."professorId"=nova."professorId"
    OR nova.inicio<=anterior.inicio OR nova.inicio IS DISTINCT FROM nova."criadaEm" OR nova.inicio < (transaction_timestamp() AT TIME ZONE 'UTC')::timestamp(3)
    OR btrim(NEW.motivo)='' OR btrim(NEW."chaveIdempotencia")='' OR btrim(NEW."entradaHash")='' THEN
    RAISE EXCEPTION 'Substituição exige designações distintas da mesma reposição, histórico aberto, início válido e motivo';
  END IF;
  IF EXISTS (
    WITH RECURSIVE cadeia(id) AS (
      SELECT NEW."designacaoNovaId"
      UNION ALL
      SELECT s."designacaoNovaId" FROM "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" s JOIN cadeia c ON s."designacaoAnteriorId"=c.id
    ) SELECT 1 FROM cadeia WHERE id=NEW."designacaoAnteriorId"
  ) THEN RAISE EXCEPTION 'Substituição não pode formar ciclo de designações'; END IF;
  IF NOT usuario_gestao_ativo(NEW."designadorId") OR nova."designadorId"<>NEW."designadorId" OR NOT usuario_professor_ativo(nova."professorId") THEN
    RAISE EXCEPTION 'Substituição exige gestão ativa e professor substituto ativo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "ReposicaoIndividual" r JOIN "DecisaoReposicaoIndividual" d ON d."reposicaoId"=r.id AND d.aprovada WHERE r.id=NEW."reposicaoId" AND r.modalidade='GRAVACAO'::"ModalidadeReposicaoIndividual") THEN
    RAISE EXCEPTION 'Substituição exige reposição gravada autorizada';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_substituicao_avaliador_reposicao BEFORE INSERT ON "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_substituicao_avaliador_reposicao();
CREATE TRIGGER proteger_substituicao_avaliador_reposicao BEFORE UPDATE OR DELETE ON "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();

-- A verificação ocorre no commit para permitir que a transação insira a nova
-- designação e seu registro de substituição sem janela de dois avaliadores.
CREATE OR REPLACE FUNCTION conferir_intervalos_designacao_avaliador_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    WITH intervalos AS (
      SELECT d.id, d."reposicaoId", d.inicio,
        COALESCE(sucessora.inicio, d.fim, 'infinity'::timestamp) AS fim_efetivo
      FROM "DesignacaoAvaliadorReposicaoIndividual" d
      LEFT JOIN "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" s ON s."designacaoAnteriorId"=d.id
      LEFT JOIN "DesignacaoAvaliadorReposicaoIndividual" sucessora ON sucessora.id=s."designacaoNovaId"
      WHERE d."reposicaoId"=NEW."reposicaoId"
    )
    SELECT 1 FROM intervalos d WHERE d.fim_efetivo<=d.inicio
    UNION ALL
    SELECT 1 FROM intervalos a JOIN intervalos b ON b."reposicaoId"=a."reposicaoId" AND b.id>a.id
    WHERE a.inicio < b.fim_efetivo AND b.inicio < a.fim_efetivo
  ) THEN
    RAISE EXCEPTION 'Uma reposição não pode ter dois avaliadores vigentes no mesmo período';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER conferir_intervalos_designacao_reposicao_apos_designacao
  AFTER INSERT ON "DesignacaoAvaliadorReposicaoIndividual" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION conferir_intervalos_designacao_avaliador_reposicao();
CREATE CONSTRAINT TRIGGER conferir_intervalos_designacao_reposicao_apos_substituicao
  AFTER INSERT ON "DesignacaoSubstituicaoAvaliadorReposicaoIndividual" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION conferir_intervalos_designacao_avaliador_reposicao();

-- Q54 já conta exatamente um avaliador na fonte de correção. Reaplicamos a
-- mesma regra sobre o intervalo efetivo, sem reabrir a designação anterior.
CREATE OR REPLACE FUNCTION conferir_fonte_correcao_conclusao_reposicao_200(
  reposicao_id TEXT, concluida BOOLEAN, encontro_reposicao_id TEXT, realizada_em TIMESTAMP(3),
  entrega_id TEXT, validada_em TIMESTAMP(3), validada_por_id TEXT
) RETURNS VOID AS $$
DECLARE reposicao "ReposicaoIndividual"%ROWTYPE; matricula "Matricula"%ROWTYPE; origem "EncontroAgenda"%ROWTYPE;
  encontro "EncontroAgenda"%ROWTYPE; entrega "EntregaReposicaoGravacao"%ROWTYPE; avaliador "Usuario"%ROWTYPE;
  agora TIMESTAMP(3) := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  SELECT * INTO reposicao FROM "ReposicaoIndividual" WHERE id=reposicao_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reposição da correção não encontrada'; END IF;
  SELECT * INTO matricula FROM "Matricula" WHERE id=reposicao."matriculaId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula da correção não encontrada'; END IF;
  SELECT * INTO origem FROM "EncontroAgenda" WHERE id=reposicao."aulaOriginalId" FOR SHARE;
  IF NOT FOUND OR origem.finalidade IS DISTINCT FROM 'AULA'::"FinalidadeEncontroAgenda" OR origem."turmaId" IS NULL OR origem.status IS DISTINCT FROM 'MINISTRADO'::"StatusEncontroAgenda" THEN
    RAISE EXCEPTION 'A correção exige aula original coletiva já ministrada';
  END IF;
  IF concluida IS FALSE THEN
    IF encontro_reposicao_id IS NOT NULL OR realizada_em IS NOT NULL OR entrega_id IS NOT NULL OR validada_em IS NOT NULL OR validada_por_id IS NOT NULL THEN
      RAISE EXCEPTION 'Retirada de conclusão não aceita fonte de reposição';
    END IF;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId"=reposicao.id AND aprovada) THEN RAISE EXCEPTION 'Correção concluída exige reposição autorizada'; END IF;
  IF reposicao.modalidade='PARTICULAR'::"ModalidadeReposicaoIndividual" THEN
    IF encontro_reposicao_id IS NULL OR realizada_em IS NULL OR entrega_id IS NOT NULL OR validada_em IS NOT NULL OR validada_por_id IS NOT NULL THEN RAISE EXCEPTION 'Correção particular exige somente encontro de reposição realizado'; END IF;
    SELECT * INTO encontro FROM "EncontroAgenda" WHERE id=encontro_reposicao_id FOR SHARE;
    IF NOT FOUND OR encontro.finalidade IS DISTINCT FROM 'REPOSICAO'::"FinalidadeEncontroAgenda" OR encontro."turmaId" IS NOT NULL OR encontro."matriculaId" IS DISTINCT FROM reposicao."matriculaId" OR encontro."reposicaoIndividualId" IS DISTINCT FROM reposicao.id OR encontro.status IS DISTINCT FROM 'MINISTRADO'::"StatusEncontroAgenda" OR encontro.fim>agora OR encontro.fim<origem.fim OR realizada_em IS DISTINCT FROM encontro.fim OR NOT EXISTS (SELECT 1 FROM "AgendaReposicaoIndividual" agenda WHERE agenda."reposicaoId"=reposicao.id AND agenda."encontroId"=encontro.id) OR NOT EXISTS (SELECT 1 FROM "AulaDiario" diario JOIN "RegistroAulaAluno" registro ON registro."aulaId"=diario.id WHERE diario."encontroId"=encontro.id AND registro."matriculaId"=reposicao."matriculaId" AND registro."alunoId"=matricula."alunoId" AND registro.participacao='PRESENTE'::"ParticipacaoAula") THEN
      RAISE EXCEPTION 'Correção particular exige agenda própria, matrícula, encontro ministrado e presença';
    END IF;
    RETURN;
  END IF;
  IF reposicao.modalidade IS DISTINCT FROM 'GRAVACAO'::"ModalidadeReposicaoIndividual" OR encontro_reposicao_id IS NOT NULL OR realizada_em IS NOT NULL OR entrega_id IS NULL OR validada_em IS NULL OR validada_por_id IS NULL OR validada_em>agora OR validada_em<origem.fim THEN RAISE EXCEPTION 'Correção gravada exige entrega e validação posterior compatíveis'; END IF;
  SELECT * INTO entrega FROM "EntregaReposicaoGravacao" WHERE id=entrega_id FOR SHARE;
  SELECT * INTO avaliador FROM "Usuario" WHERE id=validada_por_id FOR SHARE;
  IF NOT FOUND OR NOT avaliador.ativo OR NOT ('PROFESSOR'::"Papel"=ANY(avaliador.papeis)) OR entrega.id IS NULL OR entrega."reposicaoId" IS DISTINCT FROM reposicao.id OR entrega."alunoId" IS DISTINCT FROM matricula."alunoId" OR COALESCE(btrim(entrega.resumo),'')='' OR COALESCE(btrim(entrega.atividade),'')='' OR entrega."entregueEm">validada_em OR quantidade_avaliadores_reposicao_vigentes(reposicao.id,validada_em) IS DISTINCT FROM 1 OR NOT avaliador_reposicao_vigente(reposicao.id,avaliador.id,validada_em) THEN
    RAISE EXCEPTION 'Correção gravada exige entrega da matrícula e docente ativo designado na validação';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Os guards anteriores continuam validando fonte, versão e autoria. Estas
-- camadas substituem somente a noção de vigência para o fim efetivo Q40.
CREATE OR REPLACE FUNCTION validar_designacao_efetiva_conclusao_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE modalidade_reposicao "ModalidadeReposicaoIndividual";
BEGIN
  SELECT r.modalidade INTO modalidade_reposicao FROM "ReposicaoIndividual" r WHERE r.id=NEW."reposicaoId" FOR SHARE;
  IF modalidade_reposicao='GRAVACAO'::"ModalidadeReposicaoIndividual" AND (quantidade_avaliadores_reposicao_vigentes(NEW."reposicaoId",NEW."validadaEm") IS DISTINCT FROM 1 OR NOT avaliador_reposicao_vigente(NEW."reposicaoId",NEW."validadaPorId",NEW."validadaEm")) THEN
    RAISE EXCEPTION 'Gravação exige docente efetivamente designado na validação';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_designacao_efetiva_conclusao_reposicao_insercao
  BEFORE INSERT ON "ConclusaoReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_designacao_efetiva_conclusao_reposicao();

CREATE OR REPLACE FUNCTION validar_designacao_efetiva_correcao_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reposicao_id TEXT; autor "Usuario"%ROWTYPE; agora TIMESTAMP(3) := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  SELECT c."reposicaoId" INTO reposicao_id FROM "ConclusaoReposicaoIndividual" c WHERE c.id=NEW."conclusaoId" FOR SHARE;
  SELECT * INTO autor FROM "Usuario" WHERE id=NEW."autorId" FOR SHARE;
  IF reposicao_id IS NULL OR autor.id IS NULL THEN RAISE EXCEPTION 'Correção exige contexto e autor existentes'; END IF;
  IF 'PROFESSOR'::"Papel"=ANY(autor.papeis) AND NOT ('GERENTE_PEDAGOGICO'::"Papel"=ANY(autor.papeis) OR 'ADMINISTRADOR'::"Papel"=ANY(autor.papeis)) AND NOT avaliador_reposicao_vigente(reposicao_id,autor.id,agora) THEN
    RAISE EXCEPTION 'Professor não possui designação efetiva vigente para a correção';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_designacao_efetiva_correcao_reposicao_insercao
  BEFORE INSERT ON "CorrecaoConclusaoReposicaoIndividual" FOR EACH ROW EXECUTE FUNCTION validar_designacao_efetiva_correcao_reposicao();

CREATE OR REPLACE FUNCTION validar_designacao_efetiva_decisao_correcao_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reposicao_id TEXT; autor "Usuario"%ROWTYPE; agora TIMESTAMP(3) := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  IF NEW.aprovada IS NOT TRUE THEN RETURN NEW; END IF;
  SELECT conclusao."reposicaoId" INTO reposicao_id
    FROM "CorrecaoConclusaoReposicaoIndividual" correcao
    JOIN "ConclusaoReposicaoIndividual" conclusao ON conclusao.id=correcao."conclusaoId"
    WHERE correcao.id=NEW."correcaoId" FOR SHARE OF correcao, conclusao;
  SELECT usuario.* INTO autor FROM "Usuario" usuario
    JOIN "CorrecaoConclusaoReposicaoIndividual" correcao ON correcao."autorId"=usuario.id
    WHERE correcao.id=NEW."correcaoId" FOR SHARE OF usuario, correcao;
  IF reposicao_id IS NULL OR autor.id IS NULL THEN RAISE EXCEPTION 'Decisão exige correção e autor existentes'; END IF;
  IF 'PROFESSOR'::"Papel"=ANY(autor.papeis) AND NOT ('GERENTE_PEDAGOGICO'::"Papel"=ANY(autor.papeis) OR 'ADMINISTRADOR'::"Papel"=ANY(autor.papeis)) AND NOT avaliador_reposicao_vigente(reposicao_id,autor.id,agora) THEN
    RAISE EXCEPTION 'Autor da correção não possui designação efetiva vigente';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_designacao_efetiva_decisao_correcao_reposicao_insercao
  BEFORE INSERT ON "DecisaoCorrecaoConclusaoReposicao" FOR EACH ROW EXECUTE FUNCTION validar_designacao_efetiva_decisao_correcao_reposicao();

CREATE OR REPLACE FUNCTION validar_designacao_efetiva_solicitacao_correcao_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE autor "Usuario"%ROWTYPE; agora TIMESTAMP(3) := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  SELECT * INTO autor FROM "Usuario" WHERE id=NEW."solicitadaPorId" FOR SHARE;
  IF autor.id IS NULL OR NOT autor.ativo OR NOT ('PROFESSOR'::"Papel"=ANY(autor.papeis)) OR NOT avaliador_reposicao_vigente(NEW."reposicaoId",autor.id,agora) THEN
    RAISE EXCEPTION 'Solicitação de correção exige professor efetivamente designado';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_designacao_efetiva_solicitacao_correcao_insercao
  BEFORE INSERT ON "SolicitacaoCorrecaoEntregaReposicao" FOR EACH ROW EXECUTE FUNCTION validar_designacao_efetiva_solicitacao_correcao_reposicao();

CREATE OR REPLACE FUNCTION validar_designacao_efetiva_relato_reposicao() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reposicao_id TEXT; autor "Usuario"%ROWTYPE; agora TIMESTAMP(3) := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  IF NEW."relatadoPorId" IS NULL THEN RETURN NEW; END IF;
  SELECT material."reposicaoId" INTO reposicao_id FROM "MaterialReposicaoGravacao" material WHERE material.id=NEW."materialId" FOR SHARE;
  SELECT * INTO autor FROM "Usuario" WHERE id=NEW."relatadoPorId" FOR SHARE;
  IF reposicao_id IS NULL OR autor.id IS NULL THEN RAISE EXCEPTION 'Relato exige material e autor existentes'; END IF;
  IF 'PROFESSOR'::"Papel"=ANY(autor.papeis) AND NOT ('GERENTE_PEDAGOGICO'::"Papel"=ANY(autor.papeis) OR 'ADMINISTRADOR'::"Papel"=ANY(autor.papeis)) AND NOT avaliador_reposicao_vigente(reposicao_id,autor.id,agora) THEN
    RAISE EXCEPTION 'Professor não possui designação efetiva vigente para relatar a reposição';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_designacao_efetiva_relato_reposicao_insercao
  BEFORE INSERT ON "RelatoIndisponibilidadeMaterialReposicao" FOR EACH ROW EXECUTE FUNCTION validar_designacao_efetiva_relato_reposicao();
