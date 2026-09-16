-- Confirmação factual independente de um relato. Não fecha o intervalo e não
-- altera cobranças ou a disponibilidade comercial nesta etapa.
CREATE TABLE "ConfirmacaoIndisponibilidadeOfertaMatricula" (
    "id" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "confirmadorId" TEXT NOT NULL,
    confirmada BOOLEAN NOT NULL,
    motivo TEXT NOT NULL,
    "evidenciaTexto" TEXT NOT NULL,
    "confirmadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entradaHash" TEXT NOT NULL,

    CONSTRAINT "ConfirmacaoIndisponibilidadeOfertaMatricula_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfIndispOferta_registro_key"
  ON "ConfirmacaoIndisponibilidadeOfertaMatricula"("registroId");

ALTER TABLE "ConfirmacaoIndisponibilidadeOfertaMatricula"
  ADD CONSTRAINT "ConfIndispOferta_registro_fkey"
  FOREIGN KEY ("registroId") REFERENCES "RegistroIndisponibilidadeOfertaMatricula"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ConfirmacaoIndisponibilidadeOfertaMatricula"
  ADD CONSTRAINT "ConfIndispOferta_confirmador_fkey"
  FOREIGN KEY ("confirmadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE FUNCTION validar_confirmacao_indisponibilidade_oferta_matricula() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "RegistroIndisponibilidadeOfertaMatricula"%ROWTYPE; u "Usuario"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Confirmações de indisponibilidade da oferta são preservadas.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('calendario-escola', 0));
  PERFORM m.id FROM "Matricula" m JOIN "RegistroIndisponibilidadeOfertaMatricula" registro ON registro."matriculaId" = m.id
    WHERE registro.id = NEW."registroId" FOR UPDATE OF m;
  IF NOT FOUND THEN RAISE EXCEPTION 'Relato de indisponibilidade não encontrado.'; END IF;
  SELECT * INTO r FROM "RegistroIndisponibilidadeOfertaMatricula" WHERE id = NEW."registroId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id = r."autorId" FOR SHARE;
  SELECT * INTO u FROM "Usuario" WHERE id = NEW."confirmadorId" FOR SHARE;
  IF u.ativo IS DISTINCT FROM true OR NOT (u.papeis && ARRAY['GERENTE_PEDAGOGICO','ADMINISTRADOR']::"Papel"[]) THEN
    RAISE EXCEPTION 'Sem permissão para confirmar indisponibilidade da oferta.';
  END IF;
  IF NEW."confirmadorId" IS NOT DISTINCT FROM r."autorId" THEN
    RAISE EXCEPTION 'Outra pessoa deve confirmar a indisponibilidade da oferta.';
  END IF;
  IF length(trim(NEW.motivo)) NOT BETWEEN 5 AND 2000 OR length(trim(NEW."evidenciaTexto")) NOT BETWEEN 5 AND 4000
    OR NEW."entradaHash" !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Dados da confirmação de indisponibilidade inválidos.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_confirmacao_indisponibilidade_oferta_matricula
BEFORE INSERT OR UPDATE OR DELETE ON "ConfirmacaoIndisponibilidadeOfertaMatricula"
FOR EACH ROW EXECUTE FUNCTION validar_confirmacao_indisponibilidade_oferta_matricula();
