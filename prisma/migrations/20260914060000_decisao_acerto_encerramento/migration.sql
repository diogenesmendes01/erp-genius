CREATE TABLE "DecisaoAcertoEncerramento" (
 id TEXT PRIMARY KEY,
 "rascunhoId" TEXT NOT NULL UNIQUE REFERENCES "RascunhoAcertoEncerramento"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "decisorId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 aprovada BOOLEAN NOT NULL, motivo TEXT NOT NULL CHECK(length(trim(motivo)) >= 5),
 "autorizaRetroatividade" BOOLEAN NOT NULL DEFAULT false,
 "autorizaExcecaoMulta" BOOLEAN NOT NULL DEFAULT false,
 "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER decisao_acerto_preservada BEFORE UPDATE OR DELETE ON "DecisaoAcertoEncerramento"
 FOR EACH ROW EXECUTE FUNCTION preservar_cancelamento_particular();
CREATE FUNCTION conferir_decisao_acerto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "RascunhoAcertoEncerramento"; u "Usuario";
BEGIN
 SELECT * INTO r FROM "RascunhoAcertoEncerramento" WHERE id=NEW."rascunhoId" FOR SHARE;
 SELECT * INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR SHARE;
 IF NOT u.ativo OR r."preparadorId"=u.id OR NOT ('ADMINISTRADOR'=ANY(u.papeis) OR ('FINANCEIRO'=ANY(u.papeis) AND 'financeiro.aprovar_acertos'=ANY(u.permissoes))) THEN
   RAISE EXCEPTION 'Decisão exige outra pessoa autorizada';
 END IF;
 IF NEW.aprovada THEN
   IF EXISTS(SELECT 1 FROM "RascunhoAcertoEncerramento" WHERE "solicitacaoId"=r."solicitacaoId" AND versao>r.versao) THEN RAISE EXCEPTION 'Versão do acerto desatualizada'; END IF;
   IF coalesce((r.snapshot->>'exigeAprovacaoRetroatividade')::boolean,false) AND NOT NEW."autorizaRetroatividade" THEN RAISE EXCEPTION 'Retroatividade exige autorização explícita'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.snapshot->'contratos') c WHERE c->'propostaExcecaoMulta' IS NOT NULL AND c->'propostaExcecaoMulta'<>'null'::jsonb) AND NOT NEW."autorizaExcecaoMulta" THEN RAISE EXCEPTION 'Multa exige autorização explícita'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decisao_acerto_conferida BEFORE INSERT ON "DecisaoAcertoEncerramento"
 FOR EACH ROW EXECUTE FUNCTION conferir_decisao_acerto();
