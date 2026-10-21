CREATE FUNCTION conferir_dias_efetivacao_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s JSONB; p JSONB; a JSONB; data_dia TEXT;
BEGIN
 SELECT r.snapshot INTO s FROM "RascunhoAcertoEncerramento" r JOIN "DecisaoAcertoEncerramento" d ON d."rascunhoId"=r.id WHERE d.id=NEW."decisaoId";
 FOR p IN SELECT c->'lancamentos'->'plano' FROM jsonb_array_elements(s->'contratos') c LOOP
  FOR a IN SELECT * FROM jsonb_array_elements(p->'compensacoes') LOOP
   FOR data_dia IN SELECT jsonb_array_elements_text((a->'apuracao'->'diasPendentes') || (a->'apuracao'->'origem'->'diasContempladosNoProporcional')) LOOP
    IF NOT EXISTS (SELECT 1 FROM "DestinacaoDiaAcerto" de JOIN "DiaCompensacaoCobertura" dia ON dia.id=de."diaId"
     WHERE de."decisaoId"=NEW."decisaoId" AND dia."matriculaId"=p->>'matriculaId' AND dia."diaOrigem"=data_dia::date
     AND a->'compensacaoIds' ? dia."compensacaoId" AND dia.estado='LIQUIDADO_FINANCEIRAMENTE')
    THEN RAISE EXCEPTION 'Compensação pendente na efetivação'; END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER dias_efetivacao_conferidos BEFORE INSERT ON "EfetivacaoAcertoEncerramento" FOR EACH ROW EXECUTE FUNCTION conferir_dias_efetivacao_acerto();
