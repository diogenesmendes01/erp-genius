-- 230: intenção durável no mesmo commit da aplicação financeira.
CREATE TABLE "ReconciliacaoAcessoVencimento" (
 "aplicacaoId" TEXT PRIMARY KEY REFERENCES "AplicacaoVencimentoAditivo"(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
 "ultimaTentativaEm" TIMESTAMP(3), tentativas INTEGER NOT NULL DEFAULT 0 CHECK(tentativas >= 0),
 "concluidaEm" TIMESTAMP(3), erro TEXT
);
CREATE INDEX "ReconciliacaoAcessoVencimento_concluidaEm_ultimaTentativaEm_idx" ON "ReconciliacaoAcessoVencimento"("concluidaEm","ultimaTentativaEm");
CREATE FUNCTION enfileirar_acesso_vencimento_230() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "ReconciliacaoAcessoVencimento"("aplicacaoId") VALUES(NEW.id);
 RETURN NEW;
END $$;
CREATE TRIGGER enfileirar_acesso_vencimento_230 AFTER INSERT ON "AplicacaoVencimentoAditivo"
 FOR EACH ROW EXECUTE FUNCTION enfileirar_acesso_vencimento_230();
INSERT INTO "ReconciliacaoAcessoVencimento"("aplicacaoId") SELECT id FROM "AplicacaoVencimentoAditivo";
