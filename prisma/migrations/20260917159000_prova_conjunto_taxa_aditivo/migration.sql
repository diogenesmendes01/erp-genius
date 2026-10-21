-- 234: Q170 reconhece conjunto completo, nunca acerto de uma cobrança isolada.
CREATE OR REPLACE FUNCTION conferir_campos_aplicacao_direta_231(versao_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE atual "VersaoCondicoesAditivo"%ROWTYPE; origem "VersaoCondicoesAditivo"%ROWTYPE; campo TEXT;
BEGIN
 SELECT * INTO atual FROM "VersaoCondicoesAditivo" WHERE id=versao_id;
 IF atual.id IS NULL THEN RAISE EXCEPTION 'Versão indisponível'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PropostaAditivoContratual" p, LATERAL jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') a WHERE p.id=atual."propostaId" AND a->>'origem'=ANY(ARRAY['ALUNO_NOME','ALUNO_DOCUMENTO','ALUNO_EMAIL','ALUNO_ENDERECO','PAGADOR_NOME','PAGADOR_DOCUMENTO','PAGADOR_EMAIL','PAGADOR_ENDERECO','MENSALIDADE_VALOR','HORA_VALOR','AGENDA_PARTICULAR'])) THEN RAISE EXCEPTION 'A proposta contém somente condições com aplicação própria'; END IF;
 FOR campo IN SELECT jsonb_object_keys(atual.condicoes) LOOP
   WITH RECURSIVE cadeia AS (
     SELECT v.* FROM "VersaoCondicoesAditivo" v WHERE v.id=atual.id
     UNION ALL SELECT anterior.* FROM "VersaoCondicoesAditivo" anterior JOIN cadeia c ON anterior.id=c."anteriorId" AND anterior."matriculaId"=c."matriculaId" AND anterior.versao=c.versao-1
   ) SELECT c.* INTO origem FROM cadeia c JOIN "PropostaAditivoContratual" p ON p.id=c."propostaId" AND p."matriculaId"=c."matriculaId"
   WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p.snapshot->'entrada'->'alteracoes') a WHERE a->>'origem'=campo AND a->'valorEstruturado'=atual.condicoes->campo)
   AND NOT EXISTS(SELECT 1 FROM cadeia nova JOIN "PropostaAditivoContratual" np ON np.id=nova."propostaId" WHERE nova.versao>c.versao AND EXISTS(SELECT 1 FROM jsonb_array_elements(np.snapshot->'entrada'->'alteracoes') na WHERE na->>'origem'=campo))
   ORDER BY c.versao DESC LIMIT 1;
   IF origem.id IS NULL THEN RAISE EXCEPTION 'Origem explícita do campo divergente'; END IF;
   IF campo='PRIMEIRA_MENSALIDADE_VENCIMENTO' THEN
     IF NOT EXISTS(SELECT 1 FROM "AplicacaoVencimentoAditivo" a JOIN "DecisaoVencimentoAditivo" d ON d.id=a."decisaoId" AND d.aprovada JOIN "PropostaVencimentoAditivo" p ON p.id=d."propostaId" WHERE p."versaoCondicoesId"=origem.id AND p."propostaAditivoId"=origem."propostaId" AND p."matriculaId"=atual."matriculaId") THEN RAISE EXCEPTION 'Vencimento exige aplicação própria'; END IF;
   ELSIF campo = ANY(ARRAY['TAXA_VALOR','TAXA_VENCIMENTO']) THEN
     IF NOT EXISTS (
       SELECT 1 FROM "ConjuntoImpactosTaxaAditivo" c
       JOIN "DecisaoConjuntoImpactosTaxaAditivo" d ON d."conjuntoId"=c.id AND d.aprovada AND d."fotografiaHash"=c."fotografiaHash" AND d."decisorId"<>c."preparadorId"
       WHERE c.status='COMPLETO' AND c."versaoCondicoesId"=origem.id
         AND c."propostaAditivoId"=origem."propostaId" AND c."matriculaId"=atual."matriculaId"
     ) THEN RAISE EXCEPTION 'Taxa exige conjunto de impactos completo'; END IF;
   ELSIF campo = ANY(ARRAY['ALUNO_NOME','ALUNO_DOCUMENTO','ALUNO_EMAIL','ALUNO_ENDERECO','PAGADOR_NOME','PAGADOR_DOCUMENTO','PAGADOR_EMAIL','PAGADOR_ENDERECO','MENSALIDADE_VALOR','HORA_VALOR','AGENDA_PARTICULAR']) THEN
     IF origem.id<>atual.id AND NOT EXISTS(SELECT 1 FROM "AplicacaoCondicoesAditivo" a WHERE a."versaoCondicoesId"=origem.id AND a."condicoesHash"=origem."condicoesHash" AND a."matriculaId"=atual."matriculaId") THEN RAISE EXCEPTION 'Campo herdado aguarda aplicação da origem'; END IF;
   ELSE RAISE EXCEPTION 'Condição financeira exige fluxo próprio antes da aplicação';
   END IF;
 END LOOP;
END $$;

