-- Bloqueadores do piloto C1/C2 (doc 32 §0) que exigem schema:
--
-- B1 — cohort real: `PoliticaComercial.modoPiloto` + `pilotoLeadIds` (allowlist explícita).
--      Default modoPiloto=TRUE com lista vazia = NINGUÉM elegível (regra de ouro: ligar a
--      régua nunca pode virar go-live geral por acidente). Desligar o modo piloto é a
--      decisão explícita de go-live.
-- B3 — validade do disparo: `IntencaoMensagem.validaAte` (o despachante CANCELA quando
--      `agora > validaAte`, inclusive itens ADIADOS) + `DegrauComercial.toleranciaMinutos`
--      (tolerância máxima de atraso por degrau — B4).
-- B8 — `Lead.aguardandoReagendamentoEm`: pedido de REAGENDAR pausa a cadência
--      pré-experimental até a ação humana (remarcar limpa o campo).
-- B9 — `ConfigComercial.checkInToleranciaMinutos`: tolerância do alerta de check-in
--      vencido da experimental.

ALTER TABLE "PoliticaComercial"
  ADD COLUMN "modoPiloto" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pilotoLeadIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "DegrauComercial" ADD COLUMN "toleranciaMinutos" INTEGER;

ALTER TABLE "IntencaoMensagem" ADD COLUMN "validaAte" TIMESTAMP(3);

ALTER TABLE "Lead" ADD COLUMN "aguardandoReagendamentoEm" TIMESTAMP(3);

ALTER TABLE "ConfigComercial" ADD COLUMN "checkInToleranciaMinutos" INTEGER NOT NULL DEFAULT 30;
