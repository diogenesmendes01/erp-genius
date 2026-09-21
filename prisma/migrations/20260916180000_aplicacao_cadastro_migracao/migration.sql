CREATE TYPE "TipoEntradaPreparacaoMigracao" AS ENUM ('CADASTRO', 'VINCULO_MATRICULA', 'FINANCEIRO_HISTORICO', 'HISTORICO_PRESENCA');
CREATE TYPE "SituacaoAplicacaoCadastroMigracao" AS ENUM ('ENSAIO_VALIDO', 'APLICADO', 'BLOQUEADO', 'DIVERGENCIA_DESTINO');
ALTER TABLE "LinhaPreparacaoMigracao" ADD COLUMN "tipoEntrada" "TipoEntradaPreparacaoMigracao";
CREATE TABLE "MapaOrigemAlunoMigracao" (
  "id" TEXT PRIMARY KEY, "origem" TEXT NOT NULL, "alunoOrigemId" TEXT NOT NULL,
  "alunoId" TEXT NOT NULL REFERENCES "Aluno"(id) ON DELETE RESTRICT,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MapaOrigemAlunoMigracao_origem_aluno_key" UNIQUE ("origem", "alunoOrigemId"),
  CONSTRAINT "MapaOrigemAlunoMigracao_aluno_key" UNIQUE ("alunoId")
);
CREATE TABLE "AplicacaoCadastroMigracao" (
  "id" TEXT PRIMARY KEY, "linhaId" TEXT NOT NULL REFERENCES "LinhaPreparacaoMigracao"(id) ON DELETE RESTRICT,
  "entradaHash" TEXT NOT NULL, "situacao" "SituacaoAplicacaoCadastroMigracao" NOT NULL,
  "alunoId" TEXT REFERENCES "Aluno"(id) ON DELETE RESTRICT, "detalhe" TEXT,
  "executadoPorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AplicacaoCadastroMigracao_linha_hash_situacao_key" UNIQUE ("linhaId", "entradaHash", "situacao")
);
CREATE INDEX "AplicacaoCadastroMigracao_linha_criado_idx" ON "AplicacaoCadastroMigracao"("linhaId", "criadoEm");
CREATE OR REPLACE FUNCTION "guard_mapa_origem_aluno_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Mapa de origem da migração é imutável'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "guard_mapa_origem_aluno_migracao" BEFORE INSERT OR UPDATE OR DELETE ON "MapaOrigemAlunoMigracao" FOR EACH ROW EXECUTE FUNCTION "guard_mapa_origem_aluno_migracao"();
CREATE OR REPLACE FUNCTION "guard_aplicacao_cadastro_migracao"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Evidência de aplicação da migração é imutável'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u.id = NEW."executadoPorId" AND u.ativo AND 'ADMINISTRADOR'::"Papel" = ANY(u.papeis)) THEN RAISE EXCEPTION 'Executor da migração sem Administração ativa'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "LinhaPreparacaoMigracao" l WHERE l.id = NEW."linhaId" AND l."entradaHash" = NEW."entradaHash") THEN RAISE EXCEPTION 'Evidência não corresponde à fotografia da linha'; END IF;
  IF NEW.situacao = 'APLICADO'::"SituacaoAplicacaoCadastroMigracao" AND (NEW."alunoId" IS NULL OR NOT EXISTS (
    SELECT 1 FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lote ON lote.id=l."loteId" JOIN "MapaOrigemAlunoMigracao" mapa ON mapa.origem=lote.origem AND mapa."alunoOrigemId"=l."alunoOrigemId" AND mapa."alunoId"=NEW."alunoId" WHERE l.id=NEW."linhaId"
  )) THEN RAISE EXCEPTION 'Aplicação não corresponde ao mapa de origem'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "guard_aplicacao_cadastro_migracao" BEFORE INSERT OR UPDATE OR DELETE ON "AplicacaoCadastroMigracao" FOR EACH ROW EXECUTE FUNCTION "guard_aplicacao_cadastro_migracao"();
