-- Estado de confirmacao da experimental (doc 27 C2 · gap 33 do doc 28): o lead confirmou
-- presenca (botao no oficial / "SIM" no Baileys). O historico de reagendamento ja vem dos
-- eventos ExperimentalAgendada repetidos. Migration aditiva.
ALTER TABLE "Lead" ADD COLUMN "experimentalConfirmadaEm" TIMESTAMP(3);
