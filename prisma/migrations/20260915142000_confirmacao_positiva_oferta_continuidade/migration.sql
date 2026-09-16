-- Q161: confirmação positiva de oferta é uma cadeia imutável por matrícula e
-- intervalo exato. Ela não altera nem encerra relatos negativos de Q156.
CREATE TABLE "PropostaDisponibilidadeOfertaMatricula" (
  "id" TEXT NOT NULL,
  "matriculaId" TEXT NOT NULL,
  inicio DATE NOT NULL,
  fim DATE NOT NULL,
  versao INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  "evidenciaTexto" TEXT NOT NULL,
  origem JSONB NOT NULL,
  "origemHash" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropostaDisponibilidadeOfertaMatricula_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DecisaoDisponibilidadeOfertaMatricula" (
  "id" TEXT NOT NULL,
  "propostaId" TEXT NOT NULL,
  "decisorId" TEXT NOT NULL,
  aprovada BOOLEAN NOT NULL,
  motivo TEXT NOT NULL,
  "evidenciaTexto" TEXT NOT NULL,
  "entradaHash" TEXT NOT NULL,
  "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisaoDisponibilidadeOfertaMatricula_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropDispOferta_matricula_intervalo_versao_key"
  ON "PropostaDisponibilidadeOfertaMatricula"("matriculaId", inicio, fim, versao);
CREATE UNIQUE INDEX "PropDispOferta_autor_chave_key"
  ON "PropostaDisponibilidadeOfertaMatricula"("autorId", "chaveIdempotencia");
CREATE INDEX "PropDispOferta_matricula_intervalo_idx"
  ON "PropostaDisponibilidadeOfertaMatricula"("matriculaId", inicio, fim);
CREATE UNIQUE INDEX "DecDispOferta_proposta_key"
  ON "DecisaoDisponibilidadeOfertaMatricula"("propostaId");

ALTER TABLE "PropostaDisponibilidadeOfertaMatricula"
  ADD CONSTRAINT "PropDispOferta_matricula_fkey"
  FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaDisponibilidadeOfertaMatricula"
  ADD CONSTRAINT "PropDispOferta_autor_fkey"
  FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoDisponibilidadeOfertaMatricula"
  ADD CONSTRAINT "DecDispOferta_proposta_fkey"
  FOREIGN KEY ("propostaId") REFERENCES "PropostaDisponibilidadeOfertaMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoDisponibilidadeOfertaMatricula"
  ADD CONSTRAINT "DecDispOferta_decisor_fkey"
  FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION validar_proposta_disponibilidade_oferta_matricula() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE; proxima INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Propostas de disponibilidade da oferta são preservadas.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula não encontrada.'; END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Sem permissão para propor disponibilidade da oferta.';
  END IF;
  IF NEW.inicio < DATE '0001-01-01' OR NEW.fim > DATE '9999-12-31' OR NEW.inicio > NEW.fim OR NEW.versao < 1 OR length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000
    OR length(trim(NEW."evidenciaTexto")) NOT BETWEEN 5 AND 4000
    OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' OR NEW."origemHash" !~ '^[a-f0-9]{64}$'
    OR NEW.origem->>'matriculaId' IS DISTINCT FROM NEW."matriculaId"
    OR NEW.origem->>'inicio' IS DISTINCT FROM to_char(NEW.inicio, 'YYYY-MM-DD')
    OR NEW.origem->>'fim' IS DISTINCT FROM to_char(NEW.fim, 'YYYY-MM-DD')
    OR NOT (NEW.origem ? 'indisponibilidades') OR NOT (NEW.origem ? 'agenda') THEN
    RAISE EXCEPTION 'Proposta de disponibilidade da oferta inválida.';
  END IF;
  PERFORM id FROM "PropostaDisponibilidadeOfertaMatricula"
    WHERE "matriculaId" = NEW."matriculaId" AND inicio = NEW.inicio AND fim = NEW.fim FOR UPDATE;
  SELECT COALESCE(MAX(versao), 0) + 1 INTO proxima FROM "PropostaDisponibilidadeOfertaMatricula"
    WHERE "matriculaId" = NEW."matriculaId" AND inicio = NEW.inicio AND fim = NEW.fim;
  IF NEW.versao <> proxima THEN RAISE EXCEPTION 'A versão da disponibilidade deve ser a próxima deste intervalo exato.'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_proposta_disponibilidade_oferta_matricula
BEFORE INSERT OR UPDATE OR DELETE ON "PropostaDisponibilidadeOfertaMatricula"
FOR EACH ROW EXECUTE FUNCTION validar_proposta_disponibilidade_oferta_matricula();

CREATE FUNCTION validar_decisao_disponibilidade_oferta_matricula() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PropostaDisponibilidadeOfertaMatricula"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Decisões de disponibilidade da oferta são preservadas.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  SELECT * INTO p FROM "PropostaDisponibilidadeOfertaMatricula" WHERE id = NEW."propostaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta de disponibilidade não encontrada.'; END IF;
  PERFORM id FROM "Matricula" WHERE id = p."matriculaId" FOR UPDATE;
  PERFORM id FROM "PropostaDisponibilidadeOfertaMatricula" WHERE id = p.id FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Sem permissão para decidir disponibilidade da oferta.';
  END IF;
  IF NEW."decisorId" IS NOT DISTINCT FROM p."autorId" THEN RAISE EXCEPTION 'Outra pessoa deve decidir a disponibilidade da oferta.'; END IF;
  IF length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."evidenciaTexto")) NOT BETWEEN 5 AND 4000
    OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Decisão de disponibilidade da oferta inválida.'; END IF;
  IF NEW.aprovada AND EXISTS (SELECT 1 FROM "PropostaDisponibilidadeOfertaMatricula" nova
    WHERE nova."matriculaId" = p."matriculaId" AND nova.inicio = p.inicio AND nova.fim = p.fim AND nova.versao > p.versao) THEN
    RAISE EXCEPTION 'Somente a versão atual deste intervalo pode ser aprovada.';
  END IF;
  IF NEW.aprovada AND EXISTS (
    SELECT 1 FROM "RegistroIndisponibilidadeOfertaMatricula" relato
    LEFT JOIN "ConfirmacaoIndisponibilidadeOfertaMatricula" confirmacao ON confirmacao."registroId" = relato.id
    LEFT JOIN LATERAL (
      SELECT termino.fim FROM "PropostaTerminoIndisponibilidadeOferta" termino
      JOIN "DecisaoTerminoIndisponibilidadeOferta" decisao ON decisao."propostaId" = termino.id AND decisao.aprovada
      WHERE termino."registroId" = relato.id LIMIT 1
    ) termino ON true
    WHERE relato."matriculaId" = p."matriculaId" AND relato.inicio <= p.fim
      AND COALESCE(relato.fim, termino.fim, DATE '9999-12-31') >= p.inicio
      AND (confirmacao.id IS NULL OR confirmacao.confirmada)
  ) THEN RAISE EXCEPTION 'Indisponibilidade pendente ou confirmada prevalece sobre disponibilidade positiva.'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_decisao_disponibilidade_oferta_matricula
BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoDisponibilidadeOfertaMatricula"
FOR EACH ROW EXECUTE FUNCTION validar_decisao_disponibilidade_oferta_matricula();
