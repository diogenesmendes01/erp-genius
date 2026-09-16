-- Q156: proposta e decisão imutáveis para limitar relato positivo ainda aberto.
-- Não altera o relato original, matrícula, cobertura ou cobrança.
CREATE TABLE "PropostaTerminoIndisponibilidadeOferta" (
    "id" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    fim DATE NOT NULL,
    motivo TEXT NOT NULL,
    "evidenciaTexto" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaTerminoIndisponibilidadeOferta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DecisaoTerminoIndisponibilidadeOferta" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    aprovada BOOLEAN NOT NULL,
    motivo TEXT NOT NULL,
    "evidenciaTexto" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoTerminoIndisponibilidadeOferta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropTermOferta_autor_chave_key"
  ON "PropostaTerminoIndisponibilidadeOferta"("autorId", "chaveIdempotencia");
CREATE INDEX "PropTermOferta_registro_idx"
  ON "PropostaTerminoIndisponibilidadeOferta"("registroId");
CREATE UNIQUE INDEX "DecTermOferta_proposta_key"
  ON "DecisaoTerminoIndisponibilidadeOferta"("propostaId");

ALTER TABLE "PropostaTerminoIndisponibilidadeOferta"
  ADD CONSTRAINT "PropTermOferta_registro_fkey"
  FOREIGN KEY ("registroId") REFERENCES "RegistroIndisponibilidadeOfertaMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PropostaTerminoIndisponibilidadeOferta"
  ADD CONSTRAINT "PropTermOferta_autor_fkey"
  FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoTerminoIndisponibilidadeOferta"
  ADD CONSTRAINT "DecTermOferta_proposta_fkey"
  FOREIGN KEY ("propostaId") REFERENCES "PropostaTerminoIndisponibilidadeOferta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "DecisaoTerminoIndisponibilidadeOferta"
  ADD CONSTRAINT "DecTermOferta_decisor_fkey"
  FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION validar_proposta_termino_indisponibilidade_oferta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r "RegistroIndisponibilidadeOfertaMatricula"%ROWTYPE;
  u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Propostas de término de indisponibilidade da oferta são preservadas.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM m.id
    FROM "Matricula" m
    JOIN "RegistroIndisponibilidadeOfertaMatricula" registro ON registro."matriculaId" = m.id
    WHERE registro.id = NEW."registroId"
    FOR UPDATE OF m;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relato de indisponibilidade não encontrado.';
  END IF;
  SELECT * INTO r FROM "RegistroIndisponibilidadeOfertaMatricula" WHERE id = NEW."registroId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;

  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Sem permissão para propor término de indisponibilidade da oferta.';
  END IF;
  IF r.fim IS NOT NULL THEN
    RAISE EXCEPTION 'Relato já possui intervalo fechado; a retificação exige fluxo próprio.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "ConfirmacaoIndisponibilidadeOfertaMatricula" c
    WHERE c."registroId" = r.id AND c.confirmada = true
  ) THEN
    RAISE EXCEPTION 'O término exige relato de indisponibilidade confirmado positivamente.';
  END IF;
  IF NEW.fim < r.inicio OR NEW.fim < DATE '0001-01-01' OR NEW.fim > DATE '9999-12-31' THEN
    RAISE EXCEPTION 'Data de término de indisponibilidade inválida.';
  END IF;
  IF length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000
    OR length(trim(NEW."evidenciaTexto")) NOT BETWEEN 5 AND 4000
    OR length(trim(NEW."chaveIdempotencia")) NOT BETWEEN 8 AND 100
    OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Dados da proposta de término de indisponibilidade inválidos.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "PropostaTerminoIndisponibilidadeOferta" p
    LEFT JOIN "DecisaoTerminoIndisponibilidadeOferta" d ON d."propostaId" = p.id
    WHERE p."registroId" = r.id AND d.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Já existe proposta de término de indisponibilidade pendente.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "PropostaTerminoIndisponibilidadeOferta" p
    JOIN "DecisaoTerminoIndisponibilidadeOferta" d ON d."propostaId" = p.id
    WHERE p."registroId" = r.id AND d.aprovada = true
  ) THEN
    RAISE EXCEPTION 'O relato já possui término de indisponibilidade aprovado.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_proposta_termino_indisponibilidade_oferta
BEFORE INSERT OR UPDATE OR DELETE ON "PropostaTerminoIndisponibilidadeOferta"
FOR EACH ROW EXECUTE FUNCTION validar_proposta_termino_indisponibilidade_oferta();

CREATE FUNCTION validar_decisao_termino_indisponibilidade_oferta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  p "PropostaTerminoIndisponibilidadeOferta"%ROWTYPE;
  r "RegistroIndisponibilidadeOfertaMatricula"%ROWTYPE;
  u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Decisões de término de indisponibilidade da oferta são preservadas.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM m.id
    FROM "Matricula" m
    JOIN "RegistroIndisponibilidadeOfertaMatricula" registro ON registro."matriculaId" = m.id
    JOIN "PropostaTerminoIndisponibilidadeOferta" proposta ON proposta."registroId" = registro.id
    WHERE proposta.id = NEW."propostaId"
    FOR UPDATE OF m;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta de término de indisponibilidade não encontrada.';
  END IF;
  SELECT registro.* INTO r
    FROM "RegistroIndisponibilidadeOfertaMatricula" registro
    JOIN "PropostaTerminoIndisponibilidadeOferta" proposta ON proposta."registroId" = registro.id
    WHERE proposta.id = NEW."propostaId"
    FOR SHARE OF registro;
  SELECT * INTO p FROM "PropostaTerminoIndisponibilidadeOferta" WHERE id = NEW."propostaId" FOR UPDATE;
  SELECT * INTO u FROM "Usuario" WHERE id = p."autorId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."decisorId" FOR SHARE;

  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Sem permissão para decidir término de indisponibilidade da oferta.';
  END IF;
  IF NEW."decisorId" IS NOT DISTINCT FROM p."autorId" THEN
    RAISE EXCEPTION 'Outra pessoa deve decidir o término de indisponibilidade da oferta.';
  END IF;
  IF r.fim IS NOT NULL THEN
    RAISE EXCEPTION 'Relato já possui intervalo fechado; a retificação exige fluxo próprio.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "ConfirmacaoIndisponibilidadeOfertaMatricula" c
    WHERE c."registroId" = r.id AND c.confirmada = true
  ) THEN
    RAISE EXCEPTION 'O término exige relato de indisponibilidade confirmado positivamente.';
  END IF;
  IF p.fim < r.inicio OR p.fim < DATE '0001-01-01' OR p.fim > DATE '9999-12-31' THEN
    RAISE EXCEPTION 'Data de término de indisponibilidade inválida.';
  END IF;
  IF length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000
    OR length(trim(NEW."evidenciaTexto")) NOT BETWEEN 5 AND 4000
    OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Dados da decisão de término de indisponibilidade inválidos.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "PropostaTerminoIndisponibilidadeOferta" outra
    JOIN "DecisaoTerminoIndisponibilidadeOferta" d ON d."propostaId" = outra.id
    WHERE outra."registroId" = r.id AND d.aprovada = true
  ) THEN
    RAISE EXCEPTION 'O relato já possui término de indisponibilidade aprovado.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_decisao_termino_indisponibilidade_oferta
BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoTerminoIndisponibilidadeOferta"
FOR EACH ROW EXECUTE FUNCTION validar_decisao_termino_indisponibilidade_oferta();
