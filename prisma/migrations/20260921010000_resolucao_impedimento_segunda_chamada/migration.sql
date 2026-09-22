-- Q164 (decisão de 21/09/2026): a resolução do impedimento causado pela escola é
-- confirmada pela gestão pedagógica. O fato histórico (reserva em PENDENCIA_ESCOLA e sua
-- ocorrência) permanece imutável; este registro apenas o declara resolvido por uma
-- realização posterior, da mesma avaliação, com nota oficial.
CREATE TABLE "ResolucaoImpedimentoSegundaChamada" (
    "id" TEXT NOT NULL,
    "reservaImpedidaId" TEXT NOT NULL,
    "realizacaoId" TEXT NOT NULL,
    "confirmadaPorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "confirmadaEm" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),

    CONSTRAINT "ResolucaoImpedimentoSegundaChamada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResolucaoImpedimentoSegundaChamada_reservaImpedidaId_key" ON "ResolucaoImpedimentoSegundaChamada"("reservaImpedidaId");
CREATE INDEX "ResolucaoImpedimentoSegundaChamada_realizacaoId_idx" ON "ResolucaoImpedimentoSegundaChamada"("realizacaoId");
CREATE UNIQUE INDEX "ResolucaoImpedimentoSegundaChamada_confirmadaPorId_chaveIde_key" ON "ResolucaoImpedimentoSegundaChamada"("confirmadaPorId", "chaveIdempotencia");

ALTER TABLE "ResolucaoImpedimentoSegundaChamada" ADD CONSTRAINT "ResolucaoImpedimentoSegundaChamada_reservaImpedidaId_fkey" FOREIGN KEY ("reservaImpedidaId") REFERENCES "ReservaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ResolucaoImpedimentoSegundaChamada" ADD CONSTRAINT "ResolucaoImpedimentoSegundaChamada_realizacaoId_fkey" FOREIGN KEY ("realizacaoId") REFERENCES "RealizacaoSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ResolucaoImpedimentoSegundaChamada" ADD CONSTRAINT "ResolucaoImpedimentoSegundaChamada_confirmadaPorId_fkey" FOREIGN KEY ("confirmadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Guarda no banco: a aplicação valida o mesmo, mas escrita direta não pode fabricar resolução.
CREATE FUNCTION guard_resolucao_impedimento_segunda_chamada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE impedida RECORD; posterior RECORD; impedimento TIMESTAMP(3);
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Resolução de impedimento é imutável.' USING ERRCODE = '23514';
  END IF;
  SELECT r.id, r.status, r."matriculaId", r."regraId", r."codigoAvaliacao", p."alocacaoId", p."turmaId"
    INTO impedida FROM "ReservaSegundaChamada" r JOIN "PropostaSegundaChamada" p ON p.id = r."propostaId"
    WHERE r.id = NEW."reservaImpedidaId" FOR SHARE OF r;
  IF impedida.id IS NULL OR impedida.status <> 'PENDENCIA_ESCOLA' THEN
    RAISE EXCEPTION 'A reserva não possui impedimento causado pela escola.' USING ERRCODE = '23514';
  END IF;
  SELECT max(o."ocorridaEm") INTO impedimento FROM "OcorrenciaSegundaChamada" o
    WHERE o."reservaId" = impedida.id AND o.status = 'PENDENCIA_ESCOLA';
  SELECT z.id, z."realizadaEm", r.id AS "reservaId", r."matriculaId", r."regraId", r."codigoAvaliacao", p."alocacaoId", p."turmaId"
    INTO posterior FROM "RealizacaoSegundaChamada" z JOIN "ReservaSegundaChamada" r ON r.id = z."reservaId"
    JOIN "PropostaSegundaChamada" p ON p.id = r."propostaId" WHERE z.id = NEW."realizacaoId";
  IF posterior.id IS NULL OR posterior."reservaId" = impedida.id
     OR posterior."matriculaId" <> impedida."matriculaId" OR posterior."regraId" <> impedida."regraId"
     OR posterior."codigoAvaliacao" <> impedida."codigoAvaliacao" OR posterior."alocacaoId" <> impedida."alocacaoId"
     OR posterior."turmaId" <> impedida."turmaId" THEN
    RAISE EXCEPTION 'A realização não pertence à mesma avaliação da reserva impedida.' USING ERRCODE = '23514';
  END IF;
  IF impedimento IS NULL OR posterior."realizadaEm" <= impedimento THEN
    RAISE EXCEPTION 'A realização precisa ser posterior ao impedimento.' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "VersaoLancamentoAvaliacao" v JOIN "DecisaoLancamentoAvaliacao" d ON d."lancamentoId" = v.id
                 WHERE v."segundaChamadaRealizacaoId" = posterior.id AND d.aprovada) THEN
    RAISE EXCEPTION 'A realização ainda não possui nota oficial.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER resolucao_impedimento_segunda_chamada_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "ResolucaoImpedimentoSegundaChamada"
  FOR EACH ROW EXECUTE FUNCTION guard_resolucao_impedimento_segunda_chamada();
