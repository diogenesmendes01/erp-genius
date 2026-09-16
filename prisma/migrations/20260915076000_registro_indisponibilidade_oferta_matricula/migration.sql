-- Relato preservado de indisponibilidade da oferta. Não confirma a falta de
-- oferta nem produz efeito financeiro; confirmação e encerramento são fatos
-- posteriores deliberadamente fora desta migration.
CREATE TABLE "RegistroIndisponibilidadeOfertaMatricula" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    inicio DATE NOT NULL,
    fim DATE,
    motivo TEXT NOT NULL,
    "evidenciaTexto" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroIndisponibilidadeOfertaMatricula_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegIndispOferta_autor_chave_key"
  ON "RegistroIndisponibilidadeOfertaMatricula"("autorId", "chaveIdempotencia");
CREATE INDEX "RegIndispOferta_matricula_intervalo_idx"
  ON "RegistroIndisponibilidadeOfertaMatricula"("matriculaId", inicio, fim);

ALTER TABLE "RegistroIndisponibilidadeOfertaMatricula"
  ADD CONSTRAINT "RegIndispOferta_matricula_fkey"
  FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "RegistroIndisponibilidadeOfertaMatricula"
  ADD CONSTRAINT "RegIndispOferta_autor_fkey"
  FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION validar_registro_indisponibilidade_oferta_matricula() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Relatos de indisponibilidade da oferta são preservados.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM id FROM "Matricula" WHERE id = NEW."matriculaId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula não encontrada.'; END IF;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."autorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['SECRETARIA_ACADEMICA','GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Sem permissão para relatar indisponibilidade da oferta.';
  END IF;
  IF NEW.fim IS NOT NULL AND NEW.fim < NEW.inicio THEN
    RAISE EXCEPTION 'O fim da indisponibilidade não pode preceder o início.';
  END IF;
  IF length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."evidenciaTexto")) NOT BETWEEN 5 AND 4000 THEN
    RAISE EXCEPTION 'Motivo ou evidência da indisponibilidade inválidos.';
  END IF;
  IF length(trim(NEW."chaveIdempotencia")) NOT BETWEEN 8 AND 100 OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Chave de idempotência ou hash do relato inválido.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_registro_indisponibilidade_oferta_matricula
BEFORE INSERT OR UPDATE OR DELETE ON "RegistroIndisponibilidadeOfertaMatricula"
FOR EACH ROW EXECUTE FUNCTION validar_registro_indisponibilidade_oferta_matricula();
