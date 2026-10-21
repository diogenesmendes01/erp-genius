CREATE TABLE "CursorVencimentoParticular" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ultimoId" TEXT,
  "ultimaExpiraEm" TIMESTAMP(3),
  CONSTRAINT "cursor_particular_completo" CHECK (("ultimoId" IS NULL) = ("ultimaExpiraEm" IS NULL))
);
