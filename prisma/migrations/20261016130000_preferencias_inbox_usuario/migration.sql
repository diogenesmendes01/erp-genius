-- CreateTable
CREATE TABLE "PreferenciaConversaUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "fixadaEm" TIMESTAMP(3),
    "silenciadaAte" TIMESTAMP(3),
    "marcadaNaoLida" BOOLEAN NOT NULL DEFAULT false,
    "lidaAte" TIMESTAMP(3),

    CONSTRAINT "PreferenciaConversaUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoritoMensagemUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoritoMensagemUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreferenciaConversaUsuario_conversaId_idx" ON "PreferenciaConversaUsuario"("conversaId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenciaConversaUsuario_usuarioId_conversaId_key" ON "PreferenciaConversaUsuario"("usuarioId", "conversaId");

-- CreateIndex
CREATE INDEX "FavoritoMensagemUsuario_mensagemId_idx" ON "FavoritoMensagemUsuario"("mensagemId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoritoMensagemUsuario_usuarioId_mensagemId_key" ON "FavoritoMensagemUsuario"("usuarioId", "mensagemId");

-- AddForeignKey
ALTER TABLE "PreferenciaConversaUsuario" ADD CONSTRAINT "PreferenciaConversaUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenciaConversaUsuario" ADD CONSTRAINT "PreferenciaConversaUsuario_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "ConversaWhatsApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritoMensagemUsuario" ADD CONSTRAINT "FavoritoMensagemUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritoMensagemUsuario" ADD CONSTRAINT "FavoritoMensagemUsuario_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "MensagemWhatsApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
