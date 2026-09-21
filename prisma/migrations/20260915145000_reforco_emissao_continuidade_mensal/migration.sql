-- Reforça o ledger 143 com as fontes atuais que a emissão normal revalida.
-- Não reproduz o planejador de agenda: a comprovação de oferta permanece no
-- executor e no snapshot, conforme a decisão documental da Q161.
CREATE OR REPLACE FUNCTION validar_emissao_continuidade_mensal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  nova "Cobranca"%ROWTYPE;
  anterior "Cobranca"%ROWTYPE;
  matricula_atual "Matricula"%ROWTYPE;
  condicao "CondicoesContinuidadeMensalMatricula"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Emissões de continuidade mensal são preservadas.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO matricula_atual FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matrícula da emissão de continuidade não encontrada.';
  END IF;

  SELECT * INTO nova FROM "Cobranca"
    WHERE id = NEW."cobrancaId" AND "matriculaId" = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobrança nova de continuidade não encontrada.';
  END IF;
  SELECT * INTO anterior FROM "Cobranca"
    WHERE id = NEW."anteriorCobrancaId" AND "matriculaId" = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Âncora de continuidade não encontrada.';
  END IF;

  IF matricula_atual.status IS DISTINCT FROM 'ATIVA'
    OR matricula_atual."contratoOk" IS DISTINCT FROM true
    OR matricula_atual."confirmacaoContratoEm" IS NULL
    OR matricula_atual."contratoDocumentoId" IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM "PreparacaoComercialMatricula" p
      WHERE p."matriculaId" = matricula_atual.id AND p.regime = 'MENSALIDADE'
    )
    OR NOT EXISTS (
      SELECT 1 FROM "Documento" d
      WHERE d.id = matricula_atual."contratoDocumentoId"
        AND d.categoria = 'CONTRATO'
        AND d.arquivado = false
        AND (d."matriculaId" = matricula_atual.id OR d."leadId" = matricula_atual."leadId")
    ) THEN
    RAISE EXCEPTION 'A matrícula não possui contrato mensal ativo para emitir continuidade.';
  END IF;

  SELECT * INTO condicao FROM "CondicoesContinuidadeMensalMatricula"
    WHERE id = NEW.snapshot #>> '{condicoes,id}'
      AND "matriculaId" = matricula_atual.id
      AND status = 'APROVADA'
    FOR SHARE;
  IF NOT FOUND
    OR condicao.versao::text IS DISTINCT FROM NEW.snapshot #>> '{condicoes,versao}'
    OR condicao."documentoId" IS DISTINCT FROM matricula_atual."contratoDocumentoId"
    OR condicao."documentoId" IS DISTINCT FROM NEW.snapshot #>> '{condicoes,documentoId}'
    OR condicao."documentoId" IS DISTINCT FROM NEW.snapshot #>> '{documentoId}' THEN
    RAISE EXCEPTION 'A condição aprovada da continuidade não corresponde ao contrato atual.';
  END IF;

  IF nova.id = anterior.id
    OR nova.tipo <> 'MENSALIDADE'
    OR anterior.tipo <> 'MENSALIDADE'
    OR nova.status IS DISTINCT FROM 'PENDENTE'
    OR nova."valorRecebido" IS NOT NULL
    OR nova."valorLiquidadoCredito" IS DISTINCT FROM 0
    OR nova.saldo IS DISTINCT FROM nova."valorNegociado"
    OR nova."pagoEm" IS NOT NULL
    OR nova."formaPagamento" IS NOT NULL
    OR nova."comprovanteUrl" IS NOT NULL
    OR nova."comprovanteNome" IS NOT NULL
    OR nova."coberturaInicio" IS DISTINCT FROM NEW."coberturaInicio"
    OR nova."coberturaFim" IS DISTINCT FROM NEW."coberturaFim"
    OR anterior."coberturaFim" IS NULL
    OR anterior."coberturaFim" + 1 IS DISTINCT FROM NEW."coberturaInicio"
    OR NEW."snapshotHash" !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(NEW.snapshot) <> 'object'
    OR NEW.snapshot #>> '{plano,status}' IS DISTINCT FROM 'PRONTA_PARA_EMISSAO'
    OR NEW.snapshot #>> '{oferta,estado}' IS DISTINCT FROM 'SEM_RELATO'
    OR COALESCE(NEW.snapshot #>> '{comprovacaoOferta,estado}', '') NOT IN ('COMPROVADA_POR_AGENDA', 'CONFIRMADA_PELA_GESTAO')
    OR NEW.snapshot #>> '{plano,cobertura,inicio}' IS DISTINCT FROM to_char(NEW."coberturaInicio", 'YYYY-MM-DD')
    OR NEW.snapshot #>> '{plano,cobertura,fim}' IS DISTINCT FROM to_char(NEW."coberturaFim", 'YYYY-MM-DD')
    OR NEW.snapshot #>> '{plano,emissaoEm}' IS DISTINCT FROM to_char(NEW."emissaoEm", 'YYYY-MM-DD')
    OR NEW.snapshot #>> '{plano,moeda}' IS DISTINCT FROM nova.moeda
    OR (NEW.snapshot #>> '{plano,valorOriginal}')::numeric IS DISTINCT FROM nova."valorOriginal"
    OR (NEW.snapshot #>> '{plano,valorNegociado}')::numeric IS DISTINCT FROM nova."valorNegociado"
    OR EXISTS (SELECT 1 FROM "Recebimento" r WHERE r."cobrancaId" = nova.id)
    OR EXISTS (SELECT 1 FROM "PagamentoInformado" i WHERE i."cobrancaId" = nova.id)
    OR EXISTS (
      SELECT 1 FROM "PropostaUsoCredito" p
      WHERE p."cobrancaId" = nova.id
    ) THEN
    RAISE EXCEPTION 'Ledger de continuidade mensal inválido.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Cobranca" c
    WHERE c."matriculaId" = NEW."matriculaId"
      AND c.tipo = 'MENSALIDADE'
      AND c.id <> nova.id
      AND c.status <> 'CANCELADA'
      AND c."coberturaInicio" <= NEW."coberturaFim"
      AND c."coberturaFim" >= NEW."coberturaInicio"
  ) THEN
    RAISE EXCEPTION 'Cobertura mensal sobreposta.';
  END IF;
  RETURN NEW;
END $$;
