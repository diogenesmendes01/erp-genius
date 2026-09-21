-- Q121: decisão administrativa imutável sobre um pedido de desistência.
-- Esta decisão somente registra a deliberação; ela não efetiva a desistência,
-- não cancela matrícula/cobranças e não altera reservas, processos ou alocações.
CREATE TABLE "DecisaoAdministrativaDesistencia" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  "aprovada" BOOLEAN NOT NULL,
  "motivo" TEXT NOT NULL,
  "estadoHash" TEXT NOT NULL,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

  CONSTRAINT "DecisaoAdministrativaDesistencia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DecisaoAdministrativaDesistencia_motivo_tamanho"
    CHECK (length(btrim("motivo")) BETWEEN 5 AND 3000),
  CONSTRAINT "DecisaoAdministrativaDesistencia_estadoHash_formato"
    CHECK ("estadoHash" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "DecisaoAdministrativaDesistencia_pedidoId_key"
  ON "DecisaoAdministrativaDesistencia"("pedidoId");
CREATE INDEX "DecisaoAdministrativaDesistencia_decisorId_decididaEm_idx"
  ON "DecisaoAdministrativaDesistencia"("decisorId", "decididaEm");

ALTER TABLE "DecisaoAdministrativaDesistencia"
  ADD CONSTRAINT "DecisaoAdministrativaDesistencia_pedidoId_fkey"
    FOREIGN KEY ("pedidoId") REFERENCES "PedidoDesistenciaPreparacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "DecisaoAdministrativaDesistencia_decisorId_fkey"
    FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- A fotografia do pedido é feita pela conferência Q121. Esta função revalida
-- diretamente as fontes serializadas por ela, sem depender da ordenação e da
-- representação específica adotadas por JSON.stringify na aplicação.
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
        AND jsonb_array_length(COALESCE(s->'recebimentos', '[]'::jsonb)) = (SELECT count(*) FROM "Recebimento" r WHERE r."cobrancaId" = c.id)
        AND NOT EXISTS (SELECT 1 FROM "Recebimento" r WHERE r."cobrancaId" = c.id AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(s->'recebimentos') sr WHERE sr->>'id' = r.id AND (sr->>'valor')::numeric = r.valor AND sr->>'moeda' = r.moeda
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
        AND (s->>'valorInicial')::numeric = c."valorInicial" AND s->>'moeda' = c.moeda)) THEN
    RAISE EXCEPTION 'A fonte financeira mudou desde a conferência do pedido';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION validar_decisao_administrativa_desistencia()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pedido "PedidoDesistenciaPreparacao"%ROWTYPE;
  usuario_atual RECORD;
  lead_atual TEXT;
  matricula_atual RECORD;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Decisão administrativa de desistência deve permanecer preservada';
  END IF;

  -- Ordem única de serialização Q121: calendário, Lead quando houver,
  -- Matrícula e somente então o decisor em FOR SHARE.
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  -- O pedido é imutável desde a Q121; a leitura inicial só descobre a cadeia
  -- de locks. A linha é travada depois de matrícula e antes da validação.
  SELECT p.* INTO pedido FROM "PedidoDesistenciaPreparacao" p WHERE p.id = NEW."pedidoId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de desistência não encontrado';
  END IF;
  SELECT "leadId" INTO lead_atual FROM "Matricula" WHERE id = pedido."matriculaId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matrícula do pedido não encontrada';
  END IF;
  IF lead_atual IS NOT NULL THEN
    PERFORM id FROM "Lead" WHERE id = lead_atual FOR UPDATE;
  END IF;
  SELECT * INTO matricula_atual FROM "Matricula" WHERE id = pedido."matriculaId" FOR UPDATE;
  PERFORM id FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  SELECT ativo, papeis INTO usuario_atual FROM "Usuario" WHERE id = NEW."decisorId";

  IF usuario_atual.ativo IS DISTINCT FROM TRUE OR NOT ('ADMINISTRADOR'::"Papel" = ANY(usuario_atual.papeis)) THEN
    RAISE EXCEPTION 'Decisão exige administrador ativo';
  END IF;
  PERFORM id FROM "PedidoDesistenciaPreparacao" WHERE id = pedido.id FOR UPDATE;
  PERFORM id FROM "Cobranca" WHERE "matriculaId" = pedido."matriculaId" ORDER BY id FOR SHARE;
  IF NEW."decisorId" = pedido."registradorId" THEN
    RAISE EXCEPTION 'Decisão administrativa exige pessoa distinta do registrador';
  END IF;
  IF NEW."estadoHash" IS DISTINCT FROM pedido."estadoHash" THEN
    RAISE EXCEPTION 'Decisão não corresponde ao estado conferido do pedido';
  END IF;
  IF EXISTS (SELECT 1 FROM "EfetivacaoPedidoDesistenciaPreparacao" WHERE "matriculaId" = pedido."matriculaId") THEN
    RAISE EXCEPTION 'Desistência já efetivada não admite decisão administrativa';
  END IF;

  -- Rejeições permanecem como histórico mesmo após evolução das fontes; a
  -- independência, o hash do pedido e a alçada acima continuam obrigatórios.
  IF NEW.aprovada THEN
    IF matricula_atual.status NOT IN ('RASCUNHO', 'AGUARDANDO') OR matricula_atual."ativadaEm" IS NOT NULL THEN
      RAISE EXCEPTION 'Aprovação exige matrícula ainda em preparação';
    END IF;
    IF EXISTS (SELECT 1 FROM "PedidoDesistenciaPreparacao" p WHERE p."matriculaId" = pedido."matriculaId" AND p.versao > pedido.versao) THEN
      RAISE EXCEPTION 'Aprovação exige o pedido de desistência mais recente';
    END IF;
    PERFORM validar_fontes_decisao_administrativa_desistencia(pedido);
    IF NOT (
      matricula_atual."contratoOk" OR matricula_atual."confirmacaoContratoEm" IS NOT NULL
      OR EXISTS (SELECT 1 FROM "ProcessoAssinaturaContratual" p JOIN "ConclusaoAssinaturaContratual" c ON c."processoId" = p.id WHERE p."matriculaId" = pedido."matriculaId")
      OR EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId" = pedido."matriculaId" AND (
        c.status = 'PAGO' OR c."pagoEm" IS NOT NULL OR COALESCE(c."valorRecebido", 0) > 0 OR c."valorLiquidadoCredito" > 0
        OR EXISTS (SELECT 1 FROM "PagamentoInformado" i WHERE i."cobrancaId" = c.id AND i.status IN ('A_CONFERIR', 'CONFIRMADO'))
        OR EXISTS (SELECT 1 FROM "Recebimento" r WHERE r."cobrancaId" = c.id)))
    ) THEN
      RAISE EXCEPTION 'Aprovação administrativa exige avanço formal financeiro ou assinatura';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "DecisaoAdministrativaDesistencia_validar"
  BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoAdministrativaDesistencia"
  FOR EACH ROW EXECUTE FUNCTION validar_decisao_administrativa_desistencia();
