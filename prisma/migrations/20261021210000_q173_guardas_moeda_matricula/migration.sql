-- Q173, R1 do #284. Três guardas que faltavam na troca de moeda:
-- 1. Matricula.moeda só muda pela efetivação de uma AplicacaoMoedaAditivo aprovada, na mesma transação
--    (GUC local definido pela efetivação e consumido logo depois do UPDATE).
-- 2. A matrícula "limpa" passa a exigir resolvidos os direitos em andamento na moeda anterior que, depois da
--    troca, ficariam sem saída: compensação de cobertura pendente, dias de compensação aprovados e ainda não
--    recompostos nem liquidados, período integral proposto ou aprovado e não aplicado, serviço de permuta
--    confirmado sem compensação aprovada e revisão de correção de aula pendente que devolveria minutos.
--    Nada é convertido: a troca é recusada e a tela lista o que falta.
-- Funções redefinidas a partir da definição vigente (20261021200000_aplicacao_moeda_aditivo), conferidas por diff -w:
-- pendencias_moeda_antiga_173 só ganhou os cinco ramos novos; efetivar_moeda_aditivo_173 só ganhou o GUC.

CREATE OR REPLACE FUNCTION pendencias_moeda_antiga_173(matricula_id TEXT, moeda_antiga TEXT, vigencia TIMESTAMP, fuso TEXT)
RETURNS TEXT[] LANGUAGE sql STABLE AS $$
  SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::TEXT[]) FROM (
    SELECT 'COBRANCA_EM_ABERTO' AS p WHERE EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND c.status IN ('PENDENTE','ATRASADO'))
    UNION ALL SELECT 'COMPROVANTE_A_CONFERIR' WHERE EXISTS (SELECT 1 FROM "PagamentoInformado" pi JOIN "Cobranca" c ON c.id=pi."cobrancaId" WHERE c."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND pi.status='A_CONFERIR')
    UNION ALL SELECT 'COBERTURA_MENSAL_ALEM_DA_VIGENCIA' WHERE EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND c.tipo='MENSALIDADE' AND c.status<>'CANCELADA' AND c."coberturaFim" IS NOT NULL
      AND c."coberturaFim" >= ((vigencia AT TIME ZONE 'UTC') AT TIME ZONE fuso)::date)
    -- "Reserva pendente" (sexta rodada): reserva de horas pré-pagas ainda não consumida nem convertida em crédito
    -- conta como saldo; reserva liberada para remarcação devolve os minutos ao saldo.
    UNION ALL SELECT 'SALDO_HORAS_PRE_PAGAS' WHERE EXISTS (
      SELECT 1 FROM "CompraHorasAntecipadas" ch WHERE ch."matriculaId"=matricula_id AND ch.moeda=moeda_antiga
        AND ch."minutosComprados" > coalesce((SELECT lq.minutos FROM "LiquidacaoHorasAcerto" lq WHERE lq."compraId"=ch.id), 0) + coalesce((
          SELECT sum(r.minutos) FROM "ReservaHorasCompradas" r WHERE r."compraId"=ch.id
            AND (EXISTS (SELECT 1 FROM "ConsumoHorasCompradas" co WHERE co."reservaId"=r.id AND NOT EXISTS (SELECT 1 FROM "EstornoConsumoHorasCompradas" es WHERE es."consumoId"=co.id))
              OR EXISTS (SELECT 1 FROM "DecisaoLiberacaoHoras" d JOIN "PropostaLiberacaoHoras" pl ON pl.id=d."propostaId" WHERE d."reservaId"=r.id AND d.aprovada AND pl.destino='CREDITO'))), 0))
    UNION ALL SELECT 'PERMUTA_VIGENTE' WHERE EXISTS (SELECT 1 FROM "AcordoPermutaServico" a WHERE a."matriculaId"=matricula_id AND a.moeda=moeda_antiga
      AND a."vigenciaFim" >= ((vigencia AT TIME ZONE 'UTC') AT TIME ZONE fuso)::date)
    -- R1 do #284: direitos em andamento na moeda anterior. A decisão e a aplicação de cada um exigem a moeda da
    -- matrícula igual à da cobrança de origem; depois da troca, ficariam sem caminho.
    UNION ALL SELECT 'COMPENSACAO_COBERTURA_PENDENTE' WHERE EXISTS (SELECT 1 FROM "CompensacaoCoberturaMatricula" cc
      WHERE cc."matriculaId"=matricula_id AND cc.moeda=moeda_antiga AND cc.status='PENDENTE')
    UNION ALL SELECT 'DIAS_COMPENSACAO_PENDENTES' WHERE EXISTS (SELECT 1 FROM "DiaCompensacaoCobertura" dc JOIN "CompensacaoCoberturaMatricula" cc ON cc.id=dc."compensacaoId"
      WHERE cc."matriculaId"=matricula_id AND cc.moeda=moeda_antiga AND dc.estado='PENDENTE')
    -- Só a versão mais recente de cada proposta conta: a revisada foi substituída pela sucessora.
    UNION ALL SELECT 'PERIODO_INTEGRAL_PENDENTE' WHERE EXISTS (SELECT 1 FROM "PropostaPeriodoIntegral" pp JOIN "Cobranca" c ON c.id=pp."cobrancaId"
      LEFT JOIN "DecisaoPeriodoIntegral" d ON d."propostaId"=pp.id LEFT JOIN "AplicacaoPeriodoIntegral" ap ON ap."decisaoId"=d.id
      WHERE pp."matriculaId"=matricula_id AND c.moeda=moeda_antiga AND NOT EXISTS (SELECT 1 FROM "PropostaPeriodoIntegral" s WHERE s."anteriorId"=pp.id)
        AND (d.id IS NULL OR (d.aprovada AND ap.id IS NULL)))
    UNION ALL SELECT 'PERMUTA_SERVICO_SEM_COMPENSACAO' WHERE EXISTS (SELECT 1 FROM "ConfirmacaoServicoPermuta" cf JOIN "AcordoPermutaServico" a ON a.id=cf."acordoId"
      WHERE a."matriculaId"=matricula_id AND a.moeda=moeda_antiga
        AND NOT EXISTS (SELECT 1 FROM "PropostaCompensacaoPermuta" pc JOIN "DecisaoCompensacaoPermuta" d ON d."propostaId"=pc.id AND d.aprovada WHERE pc."confirmacaoId"=cf.id))
    -- Q175: aplicada depois da troca, a devolução recriaria saldo de horas pré-pagas na moeda antiga.
    UNION ALL SELECT 'REVISAO_CORRECAO_AULA_DEVOLVE_MINUTOS' WHERE EXISTS (SELECT 1 FROM "PropostaRevisaoFinanceiraCorrecaoAula" r
      JOIN "PropostaCorrecaoAula" pc ON pc.id=r."propostaCorrecaoAulaId" JOIN "EncontroAgenda" e ON e.id=pc."encontroId"
      WHERE e."matriculaId"=matricula_id AND r.fotografia->'efeito'->>'tipo'='DEVOLVE_MINUTOS' AND r.fotografia->'efeito'->>'moeda'=moeda_antiga
        AND NOT EXISTS (SELECT 1 FROM "RejeicaoCorrecaoAula" x WHERE x."propostaId"=pc.id)
        AND NOT EXISTS (SELECT 1 FROM "AprovacaoCorrecaoAula" x WHERE x."propostaId"=pc.id)
        AND NOT EXISTS (SELECT 1 FROM "PropostaCorrecaoAula" pc2 WHERE pc2."encontroId"=pc."encontroId" AND pc2.versao>pc.versao)
        AND NOT EXISTS (SELECT 1 FROM "PropostaRevisaoFinanceiraCorrecaoAula" r2 WHERE r2."propostaCorrecaoAulaId"=r."propostaCorrecaoAulaId" AND r2.versao>r.versao)
        AND NOT EXISTS (SELECT 1 FROM "DecisaoRevisaoFinanceiraCorrecaoAula" d WHERE d."propostaId"=r.id AND NOT d.aprovada))
  ) pendencias
$$;

-- A matrícula passa à moeda nova: tudo o que nasce depois (condições, mensalidades, horas) usa a moeda vigente.
-- O GUC local identifica a aplicação que autoriza este UPDATE e é consumido logo depois dele.
CREATE OR REPLACE FUNCTION efetivar_moeda_aditivo_173() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaMoedaAditivo"%ROWTYPE;
BEGIN
 SELECT p0.* INTO p FROM "PropostaMoedaAditivo" p0 JOIN "DecisaoMoedaAditivo" d ON d."propostaId"=p0.id WHERE d.id=NEW."decisaoId";
 PERFORM set_config('erp_genius.aplicacao_moeda_173', NEW.id, true);
 UPDATE "Matricula" SET moeda=NEW."moedaNova" WHERE id=p."matriculaId" AND moeda=NEW."moedaAnterior";
 IF NOT FOUND THEN RAISE EXCEPTION 'A moeda da matrícula mudou antes da aplicação'; END IF;
 PERFORM set_config('erp_genius.aplicacao_moeda_173', '', true);
 RETURN NEW;
END $$;

-- Guarda do efeito: qualquer outra escrita em Matricula.moeda (código, script ou engano) é recusada. A aplicação
-- precisa ser da mesma matrícula, com as moedas de/para iguais às do UPDATE e gravada nesta transação.
CREATE FUNCTION guardar_moeda_matricula_173() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE aplicacao_id TEXT := nullif(current_setting('erp_genius.aplicacao_moeda_173', true), '');
BEGIN
 IF NEW.moeda IS NOT DISTINCT FROM OLD.moeda THEN RETURN NEW; END IF;
 IF aplicacao_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM "AplicacaoMoedaAditivo" a JOIN "DecisaoMoedaAditivo" d ON d.id=a."decisaoId" AND d.aprovada
     JOIN "PropostaMoedaAditivo" p ON p.id=d."propostaId"
   WHERE a.id=aplicacao_id AND p."matriculaId"=OLD.id AND a."moedaAnterior"=OLD.moeda AND a."moedaNova"=NEW.moeda
     AND a."aplicadaEm"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::TIMESTAMP(3))
 THEN RAISE EXCEPTION 'A moeda da matrícula só muda pela aplicação aprovada do aditivo de moeda'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guardar_moeda_matricula_173 BEFORE UPDATE OF moeda ON "Matricula" FOR EACH ROW EXECUTE FUNCTION guardar_moeda_matricula_173();
