-- RASCUNHO 190 — não colocar em prisma/migrations sem revisão/aplicação central.
-- Protege os vínculos que as Server Actions já conferem para relato, extensão
-- de prazo e liberação pontual, sem abrir acesso para conta ou equipe alheia.

CREATE OR REPLACE FUNCTION prazo_etapa_reposicao_190(
  prazo_base TIMESTAMP(3),
  inicio_etapa TIMESTAMP(3),
  reposicao TEXT,
  prorrogacao TIMESTAMP(3)
) RETURNS TIMESTAMP(3) LANGUAGE plpgsql STABLE AS $$
DECLARE
  prazo TIMESTAMP(3) := prazo_base;
  intervalo_inicio TIMESTAMP(3);
  intervalo_fim TIMESTAMP(3);
  pausa RECORD;
BEGIN
  IF prazo_base IS NULL OR inicio_etapa IS NULL THEN RETURN NULL; END IF;
  -- Une pausas fechadas antes de somar somente as que começaram enquanto a
  -- etapa ainda estava aberta. A prorrogação permanece externa à contagem,
  -- como no cálculo usado pela ação de escrita.
  FOR pausa IN
    SELECT GREATEST(i.inicio, inicio_etapa) AS inicio, i.fim
    FROM "IndisponibilidadeMaterialReposicao" i
    JOIN "MaterialReposicaoGravacao" material ON material.id = i."materialId"
    WHERE material."reposicaoId" = reposicao
      AND i.fim IS NOT NULL AND i.fim > GREATEST(i.inicio, inicio_etapa)
    ORDER BY GREATEST(i.inicio, inicio_etapa), i.fim
  LOOP
    IF intervalo_inicio IS NULL THEN
      intervalo_inicio := pausa.inicio; intervalo_fim := pausa.fim;
    ELSIF pausa.inicio <= intervalo_fim THEN
      intervalo_fim := GREATEST(intervalo_fim, pausa.fim);
    ELSE
      IF intervalo_inicio < prazo THEN
        prazo := prazo + (intervalo_fim - intervalo_inicio);
      END IF;
      intervalo_inicio := pausa.inicio; intervalo_fim := pausa.fim;
    END IF;
  END LOOP;
  IF intervalo_inicio IS NOT NULL AND intervalo_inicio < prazo THEN
    prazo := prazo + (intervalo_fim - intervalo_inicio);
  END IF;
  IF prorrogacao IS NOT NULL AND prorrogacao > prazo THEN RETURN prorrogacao; END IF;
  RETURN prazo;
END $$;

CREATE OR REPLACE FUNCTION validar_relato_material_reposicao_190() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  autorizado BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."materialId" IS DISTINCT FROM OLD."materialId" OR
      NEW."contaPortalAlunoId" IS DISTINCT FROM OLD."contaPortalAlunoId" OR
      NEW."relatadoPorId" IS DISTINCT FROM OLD."relatadoPorId" OR
      NEW.descricao IS DISTINCT FROM OLD.descricao OR NEW."criadaEm" IS DISTINCT FROM OLD."criadaEm" THEN
      RAISE EXCEPTION 'Relato preserva material, autor e conteúdo originais';
    END IF;
    -- Confirmação posterior não pode falhar porque a conta ou matrícula mudou
    -- depois do relato legítimo. O vínculo foi validado no INSERT.
    RETURN NEW;
  END IF;

  IF NEW."contaPortalAlunoId" IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM "MaterialReposicaoGravacao" material
      JOIN "ReposicaoIndividual" r ON r.id = material."reposicaoId" AND r.modalidade = 'GRAVACAO'
      JOIN "Matricula" m ON m.id = r."matriculaId"
      JOIN "ContaPortalAluno" conta ON conta.id = NEW."contaPortalAlunoId" AND conta."alunoId" = m."alunoId" AND conta.ativa
      JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id AND decisao.aprovada
      WHERE material.id = NEW."materialId" AND material.disponivel
    ) INTO autorizado;
    IF autorizado IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Relato de portal exige conta ativa do aluno da matrícula e material gravado autorizado';
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM "MaterialReposicaoGravacao" material
      JOIN "ReposicaoIndividual" r ON r.id = material."reposicaoId" AND r.modalidade = 'GRAVACAO'
      JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id AND decisao.aprovada
      JOIN "Usuario" autor ON autor.id = NEW."relatadoPorId" AND autor.ativo
      WHERE material.id = NEW."materialId" AND material.disponivel
        AND (
          autor.papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]
          OR (
            autor.papeis @> ARRAY['PROFESSOR']::"Papel"[] AND EXISTS (
              SELECT 1 FROM "DesignacaoAvaliadorReposicaoIndividual" designacao
              WHERE designacao."reposicaoId" = r.id AND designacao."professorId" = autor.id
                AND designacao.inicio <= (clock_timestamp() AT TIME ZONE 'UTC')
                AND (designacao.fim IS NULL OR designacao.fim > (clock_timestamp() AT TIME ZONE 'UTC'))
            )
          )
        )
    ) INTO autorizado;
    IF autorizado IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Relato de equipe exige autor ativo e escopo verdadeiro do material';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_prorrogacao_prazo_reposicao_190() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  prazo_base TIMESTAMP(3);
  inicio_etapa TIMESTAMP(3);
  ultimo_prazo TIMESTAMP(3);
  ultima_versao INTEGER;
  prazo_vigente TIMESTAMP(3);
BEGIN
  IF NOT usuario_gestao_ativo(NEW."autorizadaPorId") THEN
    RAISE EXCEPTION 'Prorrogação exige Gerência Pedagógica ou Administração ativa';
  END IF;
  -- Serializa também inserções diretas: versões concorrentes não podem
  -- validar o mesmo prazo anterior em uma etapa sem prorrogações existentes.
  PERFORM 1 FROM "ReposicaoIndividual" WHERE id = NEW."reposicaoId" FOR UPDATE;
  IF NEW."solicitacaoCorrecaoId" IS NULL THEN
    SELECT disponibilidade."prazoInicialAte", disponibilidade."disponibilizadaEm"
      INTO prazo_base, inicio_etapa
      FROM "DisponibilizacaoEntregaReposicao" disponibilidade
      JOIN "ReposicaoIndividual" r ON r.id = disponibilidade."reposicaoId" AND r.modalidade = 'GRAVACAO'
      JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id AND decisao.aprovada
      WHERE disponibilidade."reposicaoId" = NEW."reposicaoId";
    SELECT "novoPrazo", versao INTO ultimo_prazo, ultima_versao
      FROM "ProrrogacaoPrazoReposicao"
      WHERE "reposicaoId" = NEW."reposicaoId" AND "solicitacaoCorrecaoId" IS NULL
      ORDER BY versao DESC LIMIT 1;
  ELSE
    SELECT correcao."prazoAte", correcao."criadaEm"
      INTO prazo_base, inicio_etapa
      FROM "SolicitacaoCorrecaoEntregaReposicao" correcao
      JOIN "ReposicaoIndividual" r ON r.id = correcao."reposicaoId" AND r.modalidade = 'GRAVACAO'
      JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id AND decisao.aprovada
      WHERE correcao.id = NEW."solicitacaoCorrecaoId"
        AND correcao."reposicaoId" = NEW."reposicaoId"
        AND correcao.situacao = 'PENDENTE';
    SELECT "novoPrazo", versao INTO ultimo_prazo, ultima_versao
      FROM "ProrrogacaoPrazoReposicao"
      WHERE "solicitacaoCorrecaoId" = NEW."solicitacaoCorrecaoId"
      ORDER BY versao DESC LIMIT 1;
  END IF;
  prazo_vigente := prazo_etapa_reposicao_190(prazo_base, inicio_etapa, NEW."reposicaoId", ultimo_prazo);
  IF prazo_vigente IS NULL OR NEW.versao <> COALESCE(ultima_versao, 0) + 1
    OR NEW."prazoAnterior" <> prazo_vigente OR NEW."novoPrazo" <= prazo_vigente
    OR NEW."novoPrazo" <= (clock_timestamp() AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Prorrogação exige a etapa atual, reposição correspondente, versão e prazo vigente';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION validar_liberacao_entrega_reposicao_190() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE agora TIMESTAMP(3) := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  IF NOT usuario_gestao_ativo(NEW."autorizadaPorId") THEN
    RAISE EXCEPTION 'Liberação exige Gerência Pedagógica ou Administração ativa';
  END IF;
  IF NEW.inicio > agora OR NEW."expiraEm" <= agora OR NOT EXISTS (
    SELECT 1
    FROM "ReposicaoIndividual" r
    JOIN "Matricula" m ON m.id = r."matriculaId" AND m.status IN ('PAUSADA', 'ENCERRADA')
    JOIN "ContaPortalAluno" conta ON conta.id = NEW."contaId" AND conta."alunoId" = m."alunoId" AND conta.ativa
    JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id AND decisao.aprovada
    WHERE r.id = NEW."reposicaoId" AND r.modalidade = 'GRAVACAO'
  ) THEN
    RAISE EXCEPTION 'Liberação exige conta ativa da matrícula pausada ou encerrada e período vigente';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "RelatoIndisponibilidadeMaterialReposicao_validar_190"
BEFORE INSERT OR UPDATE ON "RelatoIndisponibilidadeMaterialReposicao"
FOR EACH ROW EXECUTE FUNCTION validar_relato_material_reposicao_190();

CREATE TRIGGER "ProrrogacaoPrazoReposicao_validar_190"
BEFORE INSERT ON "ProrrogacaoPrazoReposicao"
FOR EACH ROW EXECUTE FUNCTION validar_prorrogacao_prazo_reposicao_190();

CREATE TRIGGER "LiberacaoEntregaReposicao_validar_190"
BEFORE INSERT ON "LiberacaoEntregaReposicao"
FOR EACH ROW EXECUTE FUNCTION validar_liberacao_entrega_reposicao_190();

CREATE TRIGGER "ProrrogacaoPrazoReposicao_proteger_190"
BEFORE UPDATE OR DELETE ON "ProrrogacaoPrazoReposicao"
FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();

CREATE TRIGGER "LiberacaoEntregaReposicao_proteger_190"
BEFORE UPDATE OR DELETE ON "LiberacaoEntregaReposicao"
FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();

CREATE TRIGGER "RelatoIndisponibilidadeMaterialReposicao_proteger_190"
BEFORE DELETE ON "RelatoIndisponibilidadeMaterialReposicao"
FOR EACH ROW EXECUTE FUNCTION proteger_reposicao_individual();
