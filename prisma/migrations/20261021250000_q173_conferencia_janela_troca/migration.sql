-- Q173, R4 do #284 (B5): aula na janela entre a vigência e a aplicação da troca. Enquanto a troca está proposta ou
-- aprovada e não aplicada, a aula com início na vigência ou depois não pode ser conferida na moeda anterior: seria
-- faturada na moeda errada. Depois da aplicação, a conferência sai na moeda nova. (No fluxo real, a versão do aditivo
-- de moeda ainda não aplicada já é barrada por exigir_aplicacao_condicoes_horas_117; esta guarda deixa a regra
-- explícita e com a mensagem própria.) Trigger nova: nenhuma função vigente é redefinida.
-- pendencias_moeda_antiga_173 não muda: HORAS_A_FATURAR já ignora o encontro posterior à vigência ainda sem conferência
-- (e.inicio < vigencia), então a aula da janela, que não pode ser conferida, não cria impasse. A conferência da moeda
-- anterior posterior à vigência só existe se foi feita antes de a troca ser proposta (vigência retroativa); essa continua
-- exigindo fechamento, e a apuração a preserva depois da troca.

CREATE FUNCTION guardar_conferencia_troca_moeda_173() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE encontro "EncontroAgenda"%ROWTYPE; vigencia_troca TIMESTAMP; fuso_troca TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  SELECT * INTO encontro FROM "EncontroAgenda" WHERE id = NEW."encontroId";
  SELECT v."vigenciaInicio", p.fuso INTO vigencia_troca, fuso_troca
    FROM "PropostaMoedaAditivo" p JOIN "VersaoCondicoesAditivo" v ON v.id = p."versaoCondicoesId"
    LEFT JOIN "DecisaoMoedaAditivo" d ON d."propostaId" = p.id LEFT JOIN "AplicacaoMoedaAditivo" a ON a."decisaoId" = d.id
    WHERE p."matriculaId" = encontro."matriculaId" AND p."moedaAnterior" = NEW.moeda AND v."vigenciaInicio" <= encontro.inicio
      AND (d.id IS NULL OR (d.aprovada AND a.id IS NULL))
    ORDER BY v."vigenciaInicio" LIMIT 1;
  IF vigencia_troca IS NOT NULL THEN
    RAISE EXCEPTION 'Há troca de moeda com vigência em % aguardando aplicação; aplique a troca antes de conferir esta aula.',
      to_char((vigencia_troca AT TIME ZONE 'UTC') AT TIME ZONE fuso_troca, 'DD/MM');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardar_conferencia_troca_moeda_173 BEFORE INSERT ON "ConferenciaOcorrenciaHoras"
  FOR EACH ROW EXECUTE FUNCTION guardar_conferencia_troca_moeda_173();
