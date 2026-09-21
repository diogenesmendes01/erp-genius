-- RASCUNHO 191 — aplicar depois de 190, fora de prisma/migrations até a
-- integração central. Uma prorrogação é um retrato autorizado do prazo então
-- vigente: pausas anteriores à autorização já estão incorporadas ao novo
-- prazo e não podem ser contadas de novo.

CREATE OR REPLACE FUNCTION prazo_etapa_reposicao_191(
  prazo_base TIMESTAMP(3),
  inicio_etapa TIMESTAMP(3),
  reposicao TEXT,
  solicitacao_correcao TEXT
) RETURNS TIMESTAMP(3) LANGUAGE plpgsql STABLE AS $$
DECLARE
  prazo TIMESTAMP(3) := prazo_base;
  marco TIMESTAMP(3) := inicio_etapa;
  intervalo_inicio TIMESTAMP(3);
  intervalo_fim TIMESTAMP(3);
  prorrogacao RECORD;
  pausa RECORD;
BEGIN
  IF prazo_base IS NULL OR inicio_etapa IS NULL THEN
    RETURN NULL;
  END IF;

  -- A última versão é o snapshot atual da etapa. O seu instante de criação é
  -- o corte que evita duplicar indisponibilidades já consideradas pela gestão.
  SELECT p."novoPrazo", p."criadaEm"
    INTO prorrogacao
    FROM "ProrrogacaoPrazoReposicao" p
    WHERE p."reposicaoId" = reposicao
      AND p."solicitacaoCorrecaoId" IS NOT DISTINCT FROM solicitacao_correcao
    ORDER BY p."criadaEm" DESC, p.versao DESC
    LIMIT 1;
  IF FOUND THEN
    prazo := prorrogacao."novoPrazo";
    marco := prorrogacao."criadaEm";
  END IF;

  -- Une pausas fechadas desde o marco. Não encerra o loop em uma pausa fora
  -- do prazo: uma união anterior já precisa ter sido processada e o cálculo
  -- deve permanecer correto sem depender da ordem do EXIT.
  FOR pausa IN
    SELECT GREATEST(i.inicio, marco) AS inicio, i.fim
    FROM "IndisponibilidadeMaterialReposicao" i
    JOIN "MaterialReposicaoGravacao" material ON material.id = i."materialId"
    WHERE material."reposicaoId" = reposicao
      AND i.fim IS NOT NULL
      AND i.fim > GREATEST(i.inicio, marco)
    ORDER BY GREATEST(i.inicio, marco), i.fim
  LOOP
    IF intervalo_inicio IS NULL THEN
      intervalo_inicio := pausa.inicio;
      intervalo_fim := pausa.fim;
    ELSIF pausa.inicio <= intervalo_fim THEN
      intervalo_fim := GREATEST(intervalo_fim, pausa.fim);
    ELSE
      IF intervalo_inicio < prazo THEN
        prazo := prazo + (intervalo_fim - intervalo_inicio);
      END IF;
      intervalo_inicio := pausa.inicio;
      intervalo_fim := pausa.fim;
    END IF;
  END LOOP;
  IF intervalo_inicio IS NOT NULL AND intervalo_inicio < prazo THEN
    prazo := prazo + (intervalo_fim - intervalo_inicio);
  END IF;
  RETURN prazo;
END $$;

CREATE OR REPLACE FUNCTION validar_prorrogacao_prazo_reposicao_191() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  prazo_base TIMESTAMP(3);
  inicio_etapa TIMESTAMP(3);
  ultima_versao INTEGER;
  prazo_vigente TIMESTAMP(3);
BEGIN
  IF NOT usuario_gestao_ativo(NEW."autorizadaPorId") THEN
    RAISE EXCEPTION 'Prorrogação exige Gerência Pedagógica ou Administração ativa';
  END IF;
  -- Também serializa inserções diretas concorrentes da mesma reposição.
  PERFORM 1 FROM "ReposicaoIndividual" WHERE id = NEW."reposicaoId" FOR UPDATE;

  IF NEW."solicitacaoCorrecaoId" IS NULL THEN
    SELECT disponibilidade."prazoInicialAte", disponibilidade."disponibilizadaEm"
      INTO prazo_base, inicio_etapa
      FROM "DisponibilizacaoEntregaReposicao" disponibilidade
      JOIN "ReposicaoIndividual" r ON r.id = disponibilidade."reposicaoId" AND r.modalidade = 'GRAVACAO'
      JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id AND decisao.aprovada
      WHERE disponibilidade."reposicaoId" = NEW."reposicaoId";
    SELECT versao INTO ultima_versao
      FROM "ProrrogacaoPrazoReposicao"
      WHERE "reposicaoId" = NEW."reposicaoId" AND "solicitacaoCorrecaoId" IS NULL
      ORDER BY "criadaEm" DESC, versao DESC LIMIT 1;
  ELSE
    SELECT correcao."prazoAte", correcao."criadaEm"
      INTO prazo_base, inicio_etapa
      FROM "SolicitacaoCorrecaoEntregaReposicao" correcao
      JOIN "ReposicaoIndividual" r ON r.id = correcao."reposicaoId" AND r.modalidade = 'GRAVACAO'
      JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id AND decisao.aprovada
      WHERE correcao.id = NEW."solicitacaoCorrecaoId"
        AND correcao."reposicaoId" = NEW."reposicaoId"
        AND correcao.situacao = 'PENDENTE';
    SELECT versao INTO ultima_versao
      FROM "ProrrogacaoPrazoReposicao"
      WHERE "solicitacaoCorrecaoId" = NEW."solicitacaoCorrecaoId"
      ORDER BY "criadaEm" DESC, versao DESC LIMIT 1;
  END IF;

  prazo_vigente := prazo_etapa_reposicao_191(
    prazo_base,
    inicio_etapa,
    NEW."reposicaoId",
    NEW."solicitacaoCorrecaoId"
  );
  IF prazo_vigente IS NULL
    OR NEW.versao <> COALESCE(ultima_versao, 0) + 1
    OR NEW."prazoAnterior" <> prazo_vigente
    OR NEW."novoPrazo" <= prazo_vigente
    OR NEW."novoPrazo" <= (clock_timestamp() AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Prorrogação exige a etapa atual, reposição correspondente, versão e prazo vigente';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "ProrrogacaoPrazoReposicao_validar_190" ON "ProrrogacaoPrazoReposicao";

CREATE TRIGGER "ProrrogacaoPrazoReposicao_validar_191"
BEFORE INSERT ON "ProrrogacaoPrazoReposicao"
FOR EACH ROW EXECUTE FUNCTION validar_prorrogacao_prazo_reposicao_191();
