-- 226: igualdade JSONB valida valores; hash corresponde à fotografia efetivamente persistida.
CREATE OR REPLACE FUNCTION conferir_fonte_vencimento_aditivo_225(p "PropostaVencimentoAditivo") RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE c "Cobranca"%ROWTYPE; v "VersaoCondicoesAditivo"%ROWTYPE; quantidade INTEGER; data_nova TEXT; foto JSONB;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola',0));
 PERFORM id FROM "Matricula" WHERE id=p."matriculaId" FOR UPDATE;
 SELECT * INTO c FROM "Cobranca" WHERE id=p."cobrancaId" FOR UPDATE;
 SELECT * INTO v FROM "VersaoCondicoesAditivo" WHERE id=p."versaoCondicoesId";
 IF c."matriculaId" IS DISTINCT FROM p."matriculaId" OR c.tipo<>'MENSALIDADE' OR c.status='CANCELADA'
 OR c.versao IS DISTINCT FROM p."versaoCobranca" OR c.vencimento IS DISTINCT FROM p."vencimentoAnterior"
 OR v."matriculaId" IS DISTINCT FROM p."matriculaId" OR v."propostaId" IS DISTINCT FROM p."propostaAditivoId"
 THEN RAISE EXCEPTION 'Origem ou fotografia do vencimento divergente'; END IF;
 SELECT count(*) INTO quantidade FROM "ItemEmissaoEntrada" i JOIN "Cobranca" x ON x.id=i."cobrancaId"
 WHERE i."matriculaId"=p."matriculaId" AND x.tipo='MENSALIDADE';
 IF quantidade<>1 OR NOT EXISTS (SELECT 1 FROM "ItemEmissaoEntrada" WHERE "matriculaId"=p."matriculaId" AND "cobrancaId"=c.id)
 THEN RAISE EXCEPTION 'Primeira mensalidade exige origem de emissão inequívoca'; END IF;
 IF EXISTS (SELECT 1 FROM "VersaoCondicoesAditivo" WHERE "matriculaId"=p."matriculaId" AND versao>v.versao)
 THEN RAISE EXCEPTION 'Versão contratual superada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "PropostaAditivoContratual" pa, jsonb_array_elements(pa.snapshot->'entrada'->'alteracoes') a
 WHERE pa.id=p."propostaAditivoId" AND a->>'origem'='PRIMEIRA_MENSALIDADE_VENCIMENTO')
 THEN RAISE EXCEPTION 'Condição herdada não autoriza novo acerto'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "ConferenciaFinalAditivo" f JOIN "ConclusaoAssinaturaAditivo" ca ON ca.id=f."conclusaoId"
 JOIN "ProcessoAssinaturaAditivo" pr ON pr.id=ca."processoId"
 WHERE f.id=v."conferenciaFinalId" AND pr."propostaId"=p."propostaAditivoId" AND pr.ambiente='PRODUCAO')
 THEN RAISE EXCEPTION 'Acerto exige aditivo assinado e conferido'; END IF;
 IF EXISTS (SELECT 1 FROM "PropostaAditivoContratual" posterior JOIN "PropostaAditivoContratual" origem ON origem.id=p."propostaAditivoId"
 WHERE posterior."matriculaId"=p."matriculaId" AND posterior.versao>origem.versao)
 THEN RAISE EXCEPTION 'Proposta contratual superada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=p.fuso) THEN RAISE EXCEPTION 'Fuso inválido'; END IF;
 data_nova := v.condicoes->'PRIMEIRA_MENSALIDADE_VENCIMENTO'->>'data';
 IF v.condicoes->'PRIMEIRA_MENSALIDADE_VENCIMENTO'->>'tipo' IS DISTINCT FROM 'DATA' OR data_nova IS NULL
 OR to_char(p."vencimentoNovo" AT TIME ZONE 'UTC' AT TIME ZONE p.fuso,'YYYY-MM-DD') IS DISTINCT FROM data_nova
 THEN RAISE EXCEPTION 'Vencimento diverge da condição contratual formalizada'; END IF;
 foto := fotografia_vencimento_aditivo_225(v.id,c.id,p.fuso,p."vencimentoNovo");
 IF p.fotografia IS DISTINCT FROM foto OR p."fotografiaHash" IS DISTINCT FROM encode(sha256(convert_to(p.fotografia::TEXT,'UTF8')),'hex')
 THEN RAISE EXCEPTION 'Fotografia financeira incompatível'; END IF;
END;
$$;
