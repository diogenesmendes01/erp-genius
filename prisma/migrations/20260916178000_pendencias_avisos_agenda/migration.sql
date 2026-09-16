CREATE TYPE "MotivoPendenciaAvisoAgenda" AS ENUM ('SEM_DESTINATARIO_AUTORIZADO', 'CONFIGURACAO_INDISPONIVEL', 'CONTATO_SEM_OPT_IN', 'CONTATO_INDISPONIVEL');
CREATE TYPE "SituacaoPendenciaAvisoAgenda" AS ENUM ('PENDENTE', 'RESOLVIDA');

CREATE TABLE "PendenciaAvisoAgenda" (
  "id" TEXT PRIMARY KEY,
  "eventoId" TEXT NOT NULL REFERENCES "Evento"(id) ON DELETE RESTRICT,
  "matriculaId" TEXT NOT NULL REFERENCES "Matricula"(id) ON DELETE RESTRICT,
  "motivo" "MotivoPendenciaAvisoAgenda" NOT NULL,
  "situacao" "SituacaoPendenciaAvisoAgenda" NOT NULL DEFAULT 'PENDENTE',
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvidaEm" TIMESTAMPTZ,
  "resolvidaPorId" TEXT REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  "observacaoResolucao" TEXT
);
CREATE INDEX "PendenciaAvisoAgenda_matriculaId_situacao_criadoEm_idx" ON "PendenciaAvisoAgenda"("matriculaId", "situacao", "criadoEm");
CREATE INDEX "PendenciaAvisoAgenda_eventoId_situacao_idx" ON "PendenciaAvisoAgenda"("eventoId", "situacao");
CREATE UNIQUE INDEX "PendenciaAvisoAgenda_evento_matricula_motivo_pendente_key" ON "PendenciaAvisoAgenda"("eventoId", "matriculaId", motivo) WHERE situacao = 'PENDENTE';
CREATE OR REPLACE FUNCTION "guard_pendencia_aviso_agenda"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Pendência de aviso não pode ser apagada'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.situacao <> 'PENDENTE'::"SituacaoPendenciaAvisoAgenda" OR NEW."resolvidaEm" IS NOT NULL OR NEW."resolvidaPorId" IS NOT NULL OR NEW."observacaoResolucao" IS NOT NULL THEN RAISE EXCEPTION 'Pendência nova deve iniciar pendente'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW."eventoId" IS DISTINCT FROM OLD."eventoId" OR NEW."matriculaId" IS DISTINCT FROM OLD."matriculaId" OR NEW.motivo IS DISTINCT FROM OLD.motivo OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" THEN RAISE EXCEPTION 'Identidade da pendência é imutável'; END IF;
  IF OLD.situacao <> 'PENDENTE'::"SituacaoPendenciaAvisoAgenda" OR NEW.situacao <> 'RESOLVIDA'::"SituacaoPendenciaAvisoAgenda" OR NEW."resolvidaEm" IS NULL OR NEW."resolvidaPorId" IS NULL OR NEW."observacaoResolucao" IS NULL OR btrim(NEW."observacaoResolucao") = '' THEN RAISE EXCEPTION 'Resolução de pendência inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id=NEW."resolvidaPorId" AND u.ativo AND u.papeis && ARRAY['ADMINISTRADOR'::"Papel", 'SECRETARIA_ACADEMICA'::"Papel"]) THEN RAISE EXCEPTION 'Resolutor sem papel ativo'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "guard_pendencia_aviso_agenda" BEFORE INSERT OR UPDATE OR DELETE ON "PendenciaAvisoAgenda" FOR EACH ROW EXECUTE FUNCTION "guard_pendencia_aviso_agenda"();