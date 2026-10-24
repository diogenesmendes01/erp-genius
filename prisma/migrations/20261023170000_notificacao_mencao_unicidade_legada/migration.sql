CREATE UNIQUE INDEX CONCURRENTLY "NotificacaoUsuario_legado_temporal_key" ON "NotificacaoUsuario"("tipo", "refId", "usuarioId", "criadaEm") WHERE "tipo" <> 'MENCAO_NOTA';
