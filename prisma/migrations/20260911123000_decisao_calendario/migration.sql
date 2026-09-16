CREATE TABLE "DecisaoCalendarioEscolar" (
 "id" TEXT PRIMARY KEY,
 "calendarioId" TEXT NOT NULL UNIQUE REFERENCES "VersaoCalendarioEscolar"("id") ON DELETE RESTRICT,
 "decisorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "aprovada" BOOLEAN NOT NULL,
 "motivo" TEXT NOT NULL CHECK (length(trim(motivo)) >= 5),
 "decididaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION conferir_decisao_calendario() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Decisão do calendário deve permanecer preservada'; END IF;
 IF EXISTS (SELECT 1 FROM "VersaoCalendarioEscolar" WHERE id = NEW."calendarioId" AND "preparadorId" = NEW."decisorId") THEN
   RAISE EXCEPTION 'Outra pessoa deve decidir o calendário';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decisao_calendario_preservada BEFORE INSERT OR UPDATE OR DELETE ON "DecisaoCalendarioEscolar"
 FOR EACH ROW EXECUTE FUNCTION conferir_decisao_calendario();
