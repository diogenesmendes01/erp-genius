-- Q242: Q165 não substitui a aprovação administrativa Q121 e não pode
-- efetivar enquanto houver solicitação de assinatura sem conclusão comprovada.
BEGIN;

-- A fotografia atual representa recebimentos por destinação. A função Q121
-- anterior ainda validava o vínculo legado singular de Recebimento.
CREATE OR REPLACE FUNCTION validar_fontes_decisao_administrativa_desistencia(pedido "PedidoDesistenciaPreparacao")
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  m RECORD;
  lead_atual TEXT;
BEGIN
  SELECT * INTO m FROM "Matricula" WHERE id = pedido."matriculaId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matrícula do pedido não encontrada';
  END IF;
  lead_atual := m."leadId";

  IF pedido."snapshotJson"->>'matriculaId' IS DISTINCT FROM pedido."matriculaId"
    OR pedido."snapshotJson"->'matricula'->>'id' IS DISTINCT FROM m.id
    OR pedido."snapshotJson"->'matricula'->>'codigo' IS DISTINCT FROM m.codigo
    OR pedido."snapshotJson"->'matricula'->>'alunoId' IS DISTINCT FROM m."alunoId"
    OR pedido."snapshotJson"->'matricula'->>'leadId' IS DISTINCT FROM m."leadId"
    OR pedido."snapshotJson"->'matricula'->>'status' IS DISTINCT FROM m.status::text
    OR pedido."snapshotJson"->'matricula'->>'ativadaEm' IS DISTINCT FROM (CASE WHEN m."ativadaEm" IS NULL THEN NULL ELSE to_char(m."ativadaEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END)
    OR pedido."snapshotJson"->'matricula'->>'contratoOk' IS DISTINCT FROM (CASE WHEN m."contratoOk" THEN 'true' ELSE 'false' END)
    OR pedido."snapshotJson"->'matricula'->>'confirmacaoContratoEm' IS DISTINCT FROM (CASE WHEN m."confirmacaoContratoEm" IS NULL THEN NULL ELSE to_char(m."confirmacaoContratoEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END)
    OR pedido."snapshotJson"->'matricula'->>'contratoDocumentoId' IS DISTINCT FROM m."contratoDocumentoId" THEN
    RAISE EXCEPTION 'A matrícula mudou desde a conferência do pedido';
  END IF;

  IF (pedido."snapshotJson"->'preparacao' = 'null'::jsonb) IS DISTINCT FROM
       (NOT EXISTS (SELECT 1 FROM "PreparacaoComercialMatricula" WHERE "matriculaId" = pedido."matriculaId"))
    OR EXISTS (
      SELECT 1 FROM "PreparacaoComercialMatricula" pc
      WHERE pc."matriculaId" = pedido."matriculaId" AND (
        pedido."snapshotJson"->'preparacao'->>'id' IS DISTINCT FROM pc.id
        OR pedido."snapshotJson"->'preparacao'->>'reservaId' IS DISTINCT FROM pc."reservaId"
        OR pedido."snapshotJson"->'preparacao'->>'reservaParticularId' IS DISTINCT FROM pc."reservaParticularId"
        OR pedido."snapshotJson"->'preparacao'->>'regime' IS DISTINCT FROM pc.regime::text
        OR pedido."snapshotJson"->'preparacao'->>'entradaHash' IS DISTINCT FROM pc."entradaHash")) THEN
    RAISE EXCEPTION 'A preparação comercial mudou desde a conferência do pedido';
  END IF;

  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'condicoes', '[]'::jsonb)) <> (SELECT count(*) FROM "CondicoesEntradaPreparacao" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "CondicoesEntradaPreparacao" c WHERE c."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'condicoes') s
      WHERE s->>'id' = c.id AND (s->>'versao')::integer = c.versao AND s->>'entradaHash' = c."entradaHash")) THEN
    RAISE EXCEPTION 'As condições de preparação mudaram desde a conferência do pedido';
  END IF;

  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasColetivas', '[]'::jsonb)) <> (SELECT count(*) FROM "ReservaVagaMatricula" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "ReservaVagaMatricula" r WHERE r."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasColetivas') s
      WHERE s->>'id' = r.id AND s->>'turmaId' = r."turmaId" AND s->>'janelaId' = r."janelaId"
        AND s->>'status' = r.status::text AND s->>'entradaHash' = r."entradaHash"
        AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC' = r."expiraEm")) THEN
    RAISE EXCEPTION 'A reserva coletiva mudou desde a conferência do pedido';
  END IF;

  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasParticulares', '[]'::jsonb)) <> (SELECT count(*) FROM "ReservaAgendaParticular" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "ReservaAgendaParticular" r WHERE r."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s
      WHERE s->>'id' = r.id AND s->>'status' = r.status::text AND s->>'entradaHash' = r."entradaHash"
        AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC' = r."expiraEm"
        AND s->'retomadaOrigem'->>'id' IS NOT DISTINCT FROM (SELECT ro.id FROM "RetomadaReservaParticular" ro WHERE ro."anteriorId" = r.id)
        AND s->'retomadaDestino'->>'id' IS NOT DISTINCT FROM (SELECT rd.id FROM "RetomadaReservaParticular" rd WHERE rd."novaId" = r.id)))
    OR EXISTS (SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" r ON r.id = h."reservaId"
      WHERE r."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s, jsonb_array_elements(s->'horarios') sh
        WHERE s->>'id' = r.id AND sh->>'id' = h.id AND sh->>'professorId' = h."professorId"
          AND sh->>'fusoOrigem' = h."fusoOrigem" AND (sh->>'inicio')::timestamptz AT TIME ZONE 'UTC' = h.inicio
          AND (sh->>'fim')::timestamptz AT TIME ZONE 'UTC' = h.fim)) THEN
    RAISE EXCEPTION 'A reserva particular mudou desde a conferência do pedido';
  END IF;

  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'processos', '[]'::jsonb)) <> (SELECT count(*) FROM "ProcessoAssinaturaContratual" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "ProcessoAssinaturaContratual" p WHERE p."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'processos') s
      WHERE s->>'id' = p.id AND s->>'estado' = p.estado::text AND s->>'fornecedor' = p.fornecedor
        AND s->>'ambiente' = p.ambiente AND s->>'referenciaExterna' IS NOT DISTINCT FROM p."referenciaExterna"
        AND s->>'artefatoId' = p."artefatoId" AND s->>'conferenciaId' = p."conferenciaId"
        AND (s->>'tentativaAtual')::integer = p."tentativaAtual"
        AND s->'conclusao'->>'id' IS NOT DISTINCT FROM (SELECT c.id FROM "ConclusaoAssinaturaContratual" c WHERE c."processoId" = p.id)
        AND s->'conclusao'->>'entradaHash' IS NOT DISTINCT FROM (SELECT c."entradaHash" FROM "ConclusaoAssinaturaContratual" c WHERE c."processoId" = p.id)
        AND s->'conclusao'->>'concluidaEm' IS NOT DISTINCT FROM (SELECT to_char(c."concluidaEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM "ConclusaoAssinaturaContratual" c WHERE c."processoId" = p.id)
        AND jsonb_array_length(COALESCE(s->'tentativas', '[]'::jsonb)) = (SELECT count(*) FROM "TentativaEnvioAssinatura" t WHERE t."processoId" = p.id)
        AND NOT EXISTS (SELECT 1 FROM "TentativaEnvioAssinatura" t WHERE t."processoId" = p.id AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(s->'tentativas') st WHERE st->>'id' = t.id AND (st->>'numero')::integer = t.numero AND st->>'revisaoHash' = t."revisaoHash"
            AND jsonb_array_length(COALESCE(st->'observacoes', '[]'::jsonb)) = (SELECT count(*) FROM "ObservacaoEnvioAssinatura" o WHERE o."tentativaId" = t.id)
            AND NOT EXISTS (SELECT 1 FROM "ObservacaoEnvioAssinatura" o WHERE o."tentativaId" = t.id AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(st->'observacoes') so WHERE so->>'id' = o.id AND so->>'resultado' = o.resultado AND so->>'evidenciaHash' = o."evidenciaHash"))))
        AND (s->'intencaoCancelamento' = 'null'::jsonb) IS NOT DISTINCT FROM (NOT EXISTS (SELECT 1 FROM "IntencaoCancelamentoAssinatura" i WHERE i."processoId" = p.id))
        AND NOT EXISTS (SELECT 1 FROM "IntencaoCancelamentoAssinatura" i WHERE i."processoId" = p.id AND (
          s->'intencaoCancelamento'->>'id' IS DISTINCT FROM i.id OR s->'intencaoCancelamento'->>'propostaId' IS DISTINCT FROM i."propostaId" OR s->'intencaoCancelamento'->>'decisaoId' IS DISTINCT FROM i."decisaoId"
          OR jsonb_array_length(COALESCE(s->'intencaoCancelamento'->'observacoes', '[]'::jsonb)) <> (SELECT count(*) FROM "ObservacaoCancelamentoAssinatura" o WHERE o."intencaoId" = i.id)
          OR EXISTS (SELECT 1 FROM "ObservacaoCancelamentoAssinatura" o WHERE o."intencaoId" = i.id AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(s->'intencaoCancelamento'->'observacoes') so WHERE so->>'id' = o.id AND so->>'resultado' = o.resultado AND so->>'evidenciaHash' = o."evidenciaHash")))))) THEN
    RAISE EXCEPTION 'O processo de assinatura mudou desde a conferência do pedido';
  END IF;

  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'documentos', '[]'::jsonb)) <> (SELECT count(*) FROM "Documento" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "Documento" d WHERE d."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'documentos') s
      WHERE s->>'id' = d.id AND (s->>'arquivado')::boolean = d.arquivado
        AND s->>'fonteHash' = encode(sha256(convert_to(
          '{"id":' || to_json(d.id)::text || ',"nome":' || to_json(d.nome)::text || ',"url":' || to_json(d.url)::text || ',"arquivado":' || to_json(d.arquivado)::text || ',"criadoEm":' || to_json(to_char(d."criadoEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text || '}',
          'UTF8')), 'hex'))) THEN
    RAISE EXCEPTION 'A fonte documental mudou desde a conferência do pedido';
  END IF;

  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'alocacoes', '[]'::jsonb)) <> (SELECT count(*) FROM "AlocacaoTurma" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "AlocacaoTurma" a WHERE a."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'alocacoes') s
      WHERE s->>'id' = a.id AND s->>'turmaId' = a."turmaId" AND (s->>'ativa')::boolean = a.ativa
        AND (s->>'criadoEm')::timestamptz AT TIME ZONE 'UTC' = a."criadoEm"
        AND (s->>'encerradaEm')::timestamptz AT TIME ZONE 'UTC' IS NOT DISTINCT FROM a."encerradaEm")) THEN
    RAISE EXCEPTION 'A alocação acadêmica mudou desde a conferência do pedido';
  END IF;

  -- A decisão administrativa pode tratar casos financeiros e documentais; sua
  -- aprovação não exige a ausência dessas fontes, apenas a fotografia atual.
  IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'financeiro'->'cobrancas', '[]'::jsonb)) <> (SELECT count(*) FROM "Cobranca" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'financeiro'->'cobrancas') s
      WHERE s->>'id' = c.id AND (s->>'versao')::integer = c.versao AND s->>'status' = c.status::text
        AND s->>'moeda' = c.moeda AND (s->>'valorOriginal')::numeric = c."valorOriginal"
        AND (s->>'valorNegociado')::numeric = c."valorNegociado" AND (s->>'valorRecebido')::numeric IS NOT DISTINCT FROM c."valorRecebido" AND (s->>'saldo')::numeric IS NOT DISTINCT FROM c.saldo
        AND (s->>'valorLiquidadoCredito')::numeric = c."valorLiquidadoCredito"
        AND s->>'pagoEm' IS NOT DISTINCT FROM (CASE WHEN c."pagoEm" IS NULL THEN NULL ELSE to_char(c."pagoEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END)
        AND s->>'vencimento' = to_char(c.vencimento AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        AND s->>'coberturaInicio' IS NOT DISTINCT FROM (CASE WHEN c."coberturaInicio" IS NULL THEN NULL ELSE to_char(c."coberturaInicio" AT TIME ZONE 'UTC', 'YYYY-MM-DD') END)
        AND s->>'coberturaFim' IS NOT DISTINCT FROM (CASE WHEN c."coberturaFim" IS NULL THEN NULL ELSE to_char(c."coberturaFim" AT TIME ZONE 'UTC', 'YYYY-MM-DD') END)
        AND s->'fontes'->>'suspensaPorItemPausaId' IS NOT DISTINCT FROM c."suspensaPorItemPausaId"
        AND s->'fontes'->>'canceladaPorPausaId' IS NOT DISTINCT FROM c."canceladaPorPausaId"
        AND s->'fontes'->>'acertoMultaDecisaoId' IS NOT DISTINCT FROM c."acertoMultaDecisaoId"
        AND s->'fontes'->'emissaoEntrada'->>'itemId' IS NOT DISTINCT FROM (SELECT ie.id FROM "ItemEmissaoEntrada" ie WHERE ie."cobrancaId" = c.id)
        AND s->'fontes'->'emissaoEntrada'->>'emissaoId' IS NOT DISTINCT FROM (SELECT ie."emissaoId" FROM "ItemEmissaoEntrada" ie WHERE ie."cobrancaId" = c.id)
        AND s->'fontes'->'emissaoEntrada'->>'etapa' IS NOT DISTINCT FROM (SELECT ee.etapa FROM "ItemEmissaoEntrada" ie JOIN "EmissaoCobrancasEntrada" ee ON ee.id = ie."emissaoId" WHERE ie."cobrancaId" = c.id)
        AND s->'fontes'->'emissaoEntrada'->>'condicoesId' IS NOT DISTINCT FROM (SELECT ee."condicoesId" FROM "ItemEmissaoEntrada" ie JOIN "EmissaoCobrancasEntrada" ee ON ee.id = ie."emissaoId" WHERE ie."cobrancaId" = c.id)
        AND s->'fontes'->'emissaoEntrada'->>'criadaEm' IS NOT DISTINCT FROM (SELECT to_char(ee."criadaEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM "ItemEmissaoEntrada" ie JOIN "EmissaoCobrancasEntrada" ee ON ee.id = ie."emissaoId" WHERE ie."cobrancaId" = c.id)
        AND s->'fontes'->'ajusteAcerto'->>'id' IS NOT DISTINCT FROM (SELECT a.id FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId" = c.id)
        AND s->'fontes'->'ajusteAcerto'->>'decisaoId' IS NOT DISTINCT FROM (SELECT a."decisaoId" FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId" = c.id)
        AND (s->'fontes'->'ajusteAcerto'->>'valorNovo')::numeric IS NOT DISTINCT FROM (SELECT a."valorNovo" FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId" = c.id)
        AND s->'fontes'->'ajusteAcerto'->>'criadoEm' IS NOT DISTINCT FROM (SELECT to_char(a."criadoEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM "AjusteCobrancaAcerto" a WHERE a."cobrancaId" = c.id)
        AND s->'fontes'->'emissaoFechamentoHoras'->>'id' IS NOT DISTINCT FROM (SELECT eh.id FROM "EmissaoFechamentoHoras" eh WHERE eh."cobrancaId" = c.id)
        AND s->'fontes'->'emissaoFechamentoHoras'->>'decisaoId' IS NOT DISTINCT FROM (SELECT eh."decisaoId" FROM "EmissaoFechamentoHoras" eh WHERE eh."cobrancaId" = c.id)
        AND s->'fontes'->'emissaoFechamentoHoras'->>'criadoEm' IS NOT DISTINCT FROM (SELECT to_char(eh."criadaEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM "EmissaoFechamentoHoras" eh WHERE eh."cobrancaId" = c.id)
        AND jsonb_array_length(COALESCE(s->'informes', '[]'::jsonb)) = (SELECT count(*) FROM "PagamentoInformado" i WHERE i."cobrancaId" = c.id)
        AND NOT EXISTS (SELECT 1 FROM "PagamentoInformado" i WHERE i."cobrancaId" = c.id AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(s->'informes') si WHERE si->>'id' = i.id AND si->>'status' = i.status::text AND (si->>'versao')::integer = i.versao
            AND (si->>'valor')::numeric = i.valor AND si->>'moeda' = i.moeda AND si->>'dataPagamento' = to_char(i."dataPagamento" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
        AND jsonb_array_length(COALESCE(s->'recebimentos', '[]'::jsonb)) = (SELECT count(*) FROM "DestinacaoRecebimento" dr WHERE dr."cobrancaId" = c.id)
        AND NOT EXISTS (SELECT 1 FROM "DestinacaoRecebimento" dr JOIN "Recebimento" r ON r.id = dr."recebimentoId" WHERE dr."cobrancaId" = c.id AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(s->'recebimentos') sr WHERE sr->>'id' = dr.id AND sr->>'recebimentoId' = r.id
            AND (sr->>'valor')::numeric = dr.valor AND sr->>'moeda' = r.moeda
            AND sr->>'dataPagamento' = to_char(r."dataPagamento" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
        AND jsonb_array_length(COALESCE(s->'utilizacoesCredito', '[]'::jsonb)) = (SELECT count(*) FROM "PropostaUsoCredito" u WHERE u."cobrancaId" = c.id)
        AND NOT EXISTS (SELECT 1 FROM "PropostaUsoCredito" u WHERE u."cobrancaId" = c.id AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(s->'utilizacoesCredito') su WHERE su->>'id' = u.id AND su->>'creditoId' = u."creditoId" AND (su->>'versao')::integer = u.versao AND (su->>'valor')::numeric = u.valor
            AND (su->'decisao' = 'null'::jsonb) IS NOT DISTINCT FROM (NOT EXISTS (SELECT 1 FROM "DecisaoUsoCredito" du WHERE du."propostaId" = u.id))
            AND su->'decisao'->>'id' IS NOT DISTINCT FROM (SELECT du.id FROM "DecisaoUsoCredito" du WHERE du."propostaId" = u.id)
            AND su->'decisao'->>'aprovada' IS NOT DISTINCT FROM (SELECT CASE WHEN du.aprovada THEN 'true' ELSE 'false' END FROM "DecisaoUsoCredito" du WHERE du."propostaId" = u.id)))
        AND jsonb_array_length(COALESCE(s->'compensacoes', '[]'::jsonb)) = (SELECT count(*) FROM "CompensacaoCoberturaMatricula" cc WHERE cc."cobrancaOrigemId" = c.id)
        AND NOT EXISTS (SELECT 1 FROM "CompensacaoCoberturaMatricula" cc WHERE cc."cobrancaOrigemId" = c.id AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(s->'compensacoes') sc WHERE sc->>'id' = cc.id AND sc->>'status' = cc.status::text AND (sc->>'cobrancaVersao')::integer = cc."cobrancaVersao"
            AND sc->>'decididaEm' IS NOT DISTINCT FROM (CASE WHEN cc."decididaEm" IS NULL THEN NULL ELSE to_char(cc."decididaEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END)
            AND jsonb_array_length(COALESCE(sc->'dias', '[]'::jsonb)) = (SELECT count(*) FROM "DiaCompensacaoCobertura" dc WHERE dc."compensacaoId" = cc.id)
            AND NOT EXISTS (SELECT 1 FROM "DiaCompensacaoCobertura" dc WHERE dc."compensacaoId" = cc.id AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(sc->'dias') sd WHERE sd->>'id' = dc.id AND sd->>'estado' = dc.estado::text AND (sd->>'versao')::integer = dc.versao))))))
    OR jsonb_array_length(COALESCE(pedido."snapshotJson"->'financeiro'->'creditos', '[]'::jsonb)) <> (SELECT count(*) FROM "CreditoMatricula" WHERE "matriculaId" = pedido."matriculaId")
    OR EXISTS (SELECT 1 FROM "CreditoMatricula" c WHERE c."matriculaId" = pedido."matriculaId" AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'financeiro'->'creditos') s
      WHERE s->>'id' = c.id AND s->>'origemLiberacaoId' IS NOT DISTINCT FROM c."origemLiberacaoId"
        AND s->>'origemAcertoId' IS NOT DISTINCT FROM c."origemAcertoId" AND s->>'origemPeriodoIntegralId' IS NOT DISTINCT FROM c."origemPeriodoIntegralId"
        AND s->>'origemDestinacaoRecebimentoId' IS NOT DISTINCT FROM c."origemDestinacaoRecebimentoId"
        AND s->>'origemAcertoDesistenciaContratualId' IS NOT DISTINCT FROM c."origemAcertoDesistenciaContratualId"
        AND (s->>'valorInicial')::numeric = c."valorInicial" AND s->>'moeda' = c.moeda
        AND s->>'criadoEm' IS NOT DISTINCT FROM to_char(c."criadoEm" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) THEN
    RAISE EXCEPTION 'A fonte financeira mudou desde a conferência do pedido';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION conferir_efetivacao_pedido_desistencia_preparacao() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE a "AplicacaoAcertoDesistenciaContratual"%ROWTYPE; d "DecisaoAcertoDesistenciaContratual"%ROWTYPE; p "PropostaAcertoDesistenciaContratual"%ROWTYPE; pe "PedidoDesistenciaPreparacao"%ROWTYPE; c "CondicoesEncerramentoMatricula"%ROWTYPE; m "Matricula"%ROWTYPE; doc "Documento"%ROWTYPE; da "DecisaoAdministrativaDesistencia"%ROWTYPE; u RECORD; administrador RECORD; pedido RECORD; matricula_atual RECORD; usuario_atual RECORD; lead_atual TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Efetivação de desistência deve permanecer preservada'; END IF;
  IF NEW."aplicacaoAcertoDesistenciaContratualId" IS NULL THEN
    SELECT p.* INTO pedido FROM "PedidoDesistenciaPreparacao" p WHERE p.id=NEW."pedidoId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de desistência não encontrado'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
    SELECT "leadId" INTO lead_atual FROM "Matricula" WHERE id=pedido."matriculaId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula do pedido não encontrada'; END IF;
    IF lead_atual IS NOT NULL THEN PERFORM id FROM "Lead" WHERE id=lead_atual FOR UPDATE; END IF;
    SELECT * INTO matricula_atual FROM "Matricula" WHERE id=pedido."matriculaId" FOR UPDATE;
    PERFORM id FROM "PedidoDesistenciaPreparacao" WHERE id=pedido.id FOR UPDATE;
    PERFORM id FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId" ORDER BY id FOR UPDATE;
    PERFORM id FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId" ORDER BY id FOR UPDATE;
    SELECT ativo,papeis INTO usuario_atual FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
    IF usuario_atual.ativo IS DISTINCT FROM true OR NOT ('SECRETARIA_ACADEMICA'=ANY(usuario_atual.papeis) OR 'ADMINISTRADOR'=ANY(usuario_atual.papeis)) THEN RAISE EXCEPTION 'Efetivação exige Secretaria ou Administração ativa'; END IF;
    IF NEW."matriculaId" IS DISTINCT FROM pedido."matriculaId" OR NEW."estadoHash" IS DISTINCT FROM pedido."estadoHash" THEN RAISE EXCEPTION 'Efetivação não corresponde ao pedido conferido'; END IF;
    IF matricula_atual.status NOT IN('RASCUNHO','AGUARDANDO') OR matricula_atual."ativadaEm" IS NOT NULL OR matricula_atual."contratoOk" OR matricula_atual."confirmacaoContratoEm" IS NOT NULL OR matricula_atual."contratoDocumentoId" IS NOT NULL THEN RAISE EXCEPTION 'Efetivação exige matrícula ainda em preparação'; END IF;
    IF EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" x WHERE x."matriculaId"=pedido."matriculaId" AND x.versao>pedido.versao) THEN RAISE EXCEPTION 'Há pedido de desistência mais recente'; END IF;
    IF pedido."snapshotJson"->'matricula'->>'status' IS DISTINCT FROM matricula_atual.status::text OR pedido."snapshotJson"->'matricula'->>'leadId' IS DISTINCT FROM lead_atual OR (pedido."snapshotJson"->'matricula'->>'ativadaEm') IS DISTINCT FROM (CASE WHEN matricula_atual."ativadaEm" IS NULL THEN NULL ELSE to_char(matricula_atual."ativadaEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END) OR (pedido."snapshotJson"->'matricula'->>'contratoOk') IS DISTINCT FROM (CASE WHEN matricula_atual."contratoOk" THEN 'true' ELSE 'false' END) OR (pedido."snapshotJson"->'matricula'->>'confirmacaoContratoEm') IS DISTINCT FROM (CASE WHEN matricula_atual."confirmacaoContratoEm" IS NULL THEN NULL ELSE to_char(matricula_atual."confirmacaoContratoEm" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END) OR pedido."snapshotJson"->'matricula'->>'contratoDocumentoId' IS DISTINCT FROM matricula_atual."contratoDocumentoId" THEN RAISE EXCEPTION 'A fonte da matrícula mudou desde a conferência'; END IF;
    IF (pedido."snapshotJson"->'preparacao'='null'::jsonb) IS DISTINCT FROM (NOT EXISTS(SELECT 1 FROM "PreparacaoComercialMatricula" WHERE "matriculaId"=pedido."matriculaId")) OR EXISTS(SELECT 1 FROM "PreparacaoComercialMatricula" pc WHERE pc."matriculaId"=pedido."matriculaId" AND (pedido."snapshotJson"->'preparacao'->>'id' IS DISTINCT FROM pc.id OR pedido."snapshotJson"->'preparacao'->>'reservaId' IS DISTINCT FROM pc."reservaId" OR pedido."snapshotJson"->'preparacao'->>'reservaParticularId' IS DISTINCT FROM pc."reservaParticularId" OR pedido."snapshotJson"->'preparacao'->>'regime' IS DISTINCT FROM pc.regime::text OR pedido."snapshotJson"->'preparacao'->>'entradaHash' IS DISTINCT FROM pc."entradaHash")) THEN RAISE EXCEPTION 'A preparação comercial mudou desde a conferência'; END IF;
    IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'condicoes','[]'::jsonb))<>(SELECT count(*) FROM "CondicoesEntradaPreparacao" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "CondicoesEntradaPreparacao" cc WHERE cc."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'condicoes') s WHERE s->>'id'=cc.id AND (s->>'versao')::integer=cc.versao AND s->>'entradaHash'=cc."entradaHash")) THEN RAISE EXCEPTION 'As condições de preparação mudaram desde a conferência'; END IF;
    IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasColetivas','[]'::jsonb))<>(SELECT count(*) FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "ReservaVagaMatricula" r WHERE r."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasColetivas') s WHERE s->>'id'=r.id AND s->>'turmaId'=r."turmaId" AND s->>'janelaId'=r."janelaId" AND s->>'status'=r.status::text AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC'=r."expiraEm" AND s->>'entradaHash'=r."entradaHash")) THEN RAISE EXCEPTION 'A reserva coletiva mudou desde a conferência'; END IF;
    IF jsonb_array_length(COALESCE(pedido."snapshotJson"->'reservasParticulares','[]'::jsonb))<>(SELECT count(*) FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" r WHERE r."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s WHERE s->>'id'=r.id AND s->>'status'=r.status::text AND (s->>'expiraEm')::timestamptz AT TIME ZONE 'UTC'=r."expiraEm" AND s->>'entradaHash'=r."entradaHash")) OR EXISTS(SELECT 1 FROM "HorarioReservaParticular" h JOIN "ReservaAgendaParticular" r ON r.id=h."reservaId" WHERE r."matriculaId"=pedido."matriculaId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pedido."snapshotJson"->'reservasParticulares') s,jsonb_array_elements(s->'horarios') hjson WHERE s->>'id'=r.id AND hjson->>'id'=h.id AND hjson->>'professorId'=h."professorId" AND hjson->>'fusoOrigem'=h."fusoOrigem" AND (hjson->>'inicio')::timestamptz AT TIME ZONE 'UTC'=h.inicio AND (hjson->>'fim')::timestamptz AT TIME ZONE 'UTC'=h.fim)) THEN RAISE EXCEPTION 'A reserva particular mudou desde a conferência'; END IF;
    IF (NEW."decisaoFinanceiraId" IS NULL AND EXISTS(SELECT 1 FROM "Cobranca" WHERE "matriculaId"=pedido."matriculaId")) OR EXISTS(SELECT 1 FROM "CreditoMatricula" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "Documento" WHERE "matriculaId"=pedido."matriculaId") OR EXISTS(SELECT 1 FROM "AlocacaoTurma" WHERE "matriculaId"=pedido."matriculaId") THEN RAISE EXCEPTION 'Efetivação simples exige ausência de avanço financeiro, documental, assinatura e alocação'; END IF;
    IF EXISTS(SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId" AND status='UTILIZADA') OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId" AND status='UTILIZADA') THEN RAISE EXCEPTION 'Reserva utilizada exige fluxo de acerto'; END IF;
    IF EXISTS(SELECT 1 FROM "ReservaVagaMatricula" WHERE "matriculaId"=pedido."matriculaId" AND status NOT IN('ATIVA','MANTIDA_PENDENCIA','EXPIRADA','LIBERADA')) OR EXISTS(SELECT 1 FROM "ReservaAgendaParticular" WHERE "matriculaId"=pedido."matriculaId" AND status NOT IN('ATIVA','MANTIDA_PENDENCIA','EXPIRADA','LIBERADA')) THEN RAISE EXCEPTION 'Estado de reserva incompatível com a efetivação'; END IF;
    IF NEW."decisaoFinanceiraId" IS NOT NULL THEN PERFORM validar_aprovacao_financeira_desistencia(NEW."decisaoFinanceiraId",NEW."pedidoId",NEW."estadoHash"); END IF;
    RETURN NEW;
  END IF;
  IF NEW."decisaoFinanceiraId" IS NOT NULL THEN RAISE EXCEPTION 'Efetivação Q165 deve ser uma inserção contratual exclusiva'; END IF;
  SELECT * INTO a FROM "AplicacaoAcertoDesistenciaContratual" WHERE id=NEW."aplicacaoAcertoDesistenciaContratualId" FOR SHARE;
  SELECT * INTO d FROM "DecisaoAcertoDesistenciaContratual" WHERE id=a."decisaoId" FOR SHARE;
  SELECT * INTO p FROM "PropostaAcertoDesistenciaContratual" WHERE id=d."propostaId" FOR UPDATE;
  SELECT * INTO pe FROM "PedidoDesistenciaPreparacao" WHERE id=p."pedidoId" FOR UPDATE;
  SELECT * INTO c FROM "CondicoesEncerramentoMatricula" WHERE id=p."condicoesId" FOR SHARE;
  SELECT * INTO m FROM "Matricula" WHERE id=pe."matriculaId" FOR UPDATE;
  SELECT * INTO doc FROM "Documento" WHERE id=c."documentoId" FOR SHARE;
  SELECT * INTO da FROM "DecisaoAdministrativaDesistencia" WHERE "pedidoId"=pe.id FOR SHARE;
  SELECT ativo,papeis INTO administrador FROM "Usuario" WHERE id=da."decisorId" FOR SHARE;
  SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=NEW."executorId" FOR SHARE;
  PERFORM id FROM "Cobranca" WHERE "matriculaId"=pe."matriculaId" ORDER BY id FOR UPDATE;
  PERFORM id FROM "ProcessoAssinaturaContratual" WHERE "matriculaId"=pe."matriculaId" ORDER BY id FOR UPDATE;
  IF a.id IS NULL OR d.id IS NULL OR p.id IS NULL OR pe.id IS NULL OR c.id IS NULL OR m.id IS NULL OR doc.id IS NULL
    OR NOT d.aprovada OR a."condicoesHash" IS DISTINCT FROM p."condicoesHash" OR a."fotografiaHash" IS DISTINCT FROM p."fotografiaHash" OR a.memoria IS DISTINCT FROM p.memoria
    OR da.id IS NULL OR NOT da.aprovada OR da."estadoHash" IS DISTINCT FROM pe."estadoHash" OR da."decisorId" IS NOT DISTINCT FROM pe."registradorId"
    OR administrador.ativo IS DISTINCT FROM true OR NOT ('ADMINISTRADOR'=ANY(administrador.papeis))
    OR NEW."pedidoId" IS DISTINCT FROM pe.id OR NEW."matriculaId" IS DISTINCT FROM pe."matriculaId" OR NEW."estadoHash" IS DISTINCT FROM pe."estadoHash"
    OR u.ativo IS DISTINCT FROM true OR NOT ('SECRETARIA_ACADEMICA'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis))
    OR m.status NOT IN ('RASCUNHO','AGUARDANDO') OR m."ativadaEm" IS NOT NULL OR NOT m."contratoOk" OR m."confirmacaoContratoEm" IS NULL OR m."confirmacaoContratoPorId" IS NULL
    OR c.status<>'APROVADA' OR c."matriculaId" IS DISTINCT FROM m.id OR c."documentoId" IS DISTINCT FROM m."contratoDocumentoId" OR doc."matriculaId" IS DISTINCT FROM m.id OR doc.arquivado
    OR EXISTS(SELECT 1 FROM "PedidoDesistenciaPreparacao" x WHERE x."matriculaId"=m.id AND x.versao>pe.versao)
    OR EXISTS(SELECT 1 FROM "CondicoesEncerramentoMatricula" x WHERE x."matriculaId"=m.id AND x.versao>c.versao)
    OR EXISTS(SELECT 1 FROM "ProcessoAssinaturaContratual" processo WHERE processo."matriculaId"=m.id
      AND NOT EXISTS(SELECT 1 FROM "ConclusaoAssinaturaContratual" conclusao WHERE conclusao."processoId"=processo.id)
      AND NOT EXISTS(
        SELECT 1
        FROM "IntencaoCancelamentoAssinatura" intencao
        JOIN "PropostaSubstituicaoContratual" proposta_substituicao ON proposta_substituicao.id=intencao."propostaId"
        JOIN "DecisaoSubstituicaoContratual" decisao_substituicao ON decisao_substituicao.id=intencao."decisaoId"
        JOIN "AplicacaoSubstituicaoContratual" aplicacao_substituicao ON aplicacao_substituicao."intencaoId"=intencao.id
        JOIN "ObservacaoCancelamentoAssinatura" observacao ON observacao.id=aplicacao_substituicao."observacaoId"
        WHERE processo.estado='CANCELADO'
          AND intencao."processoId"=processo.id AND intencao."referenciaExterna"=processo."referenciaExterna"
          AND proposta_substituicao."processoFonteId"=processo.id AND proposta_substituicao."matriculaId"=m.id
          AND intencao."propostaHash"=proposta_substituicao."entradaHash"
          AND decisao_substituicao."propostaId"=proposta_substituicao.id AND decisao_substituicao.aprovada
          AND decisao_substituicao."decisorId" IS DISTINCT FROM proposta_substituicao."preparadaPorId"
          AND decisao_substituicao."propostaHash"=proposta_substituicao."entradaHash"
          AND aplicacao_substituicao."propostaHash"=intencao."propostaHash"
          AND observacao."intencaoId"=intencao.id AND observacao.resultado='CONFIRMADO'
          AND observacao."referenciaExterna"=intencao."referenciaExterna"))
    OR EXISTS(SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" x WHERE x."matriculaId"=m.id) THEN
    RAISE EXCEPTION 'Efetivação Q165 não corresponde ao pedido, contrato e aplicação aprovados';
  END IF;
  PERFORM q165_validar_efeitos_aplicacao(a.id);
  RETURN NEW;
END $$;
COMMIT;
