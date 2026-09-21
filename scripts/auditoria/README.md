# Reprodução da auditoria de setembro/2026

Scripts exclusivos de auditoria, sem mudanças nas regras da aplicação. Usar somente banco descartável `erp_genius_test`, em `localhost:54329`. A suíte **trunca as tabelas desse banco entre cenários**; não executar enquanto outra suíte ou instância de teste utiliza os mesmos dados.

1. Instalar dependências com `npm ci`.
2. Subir Postgres local pela infraestrutura de teste do projeto. Neste Windows, `npm run test:db` apresentou problemas; ver doc 34. Com o servidor já disponível, `node scripts/auditoria/preparar-banco.mjs` cria apenas o banco local de teste se necessário.
3. Executar `npx vitest run -c scripts/auditoria/vitest.config.ts --reporter=json --outputFile=docs/auditoria-2026-09-resultados.json`.

As falhas são esperadas no commit bc858af. Os testes exprimem critérios de integridade e acesso; F07/F08/F10 incluem políticas que precisam de decisão. F03 está pulado por incompatibilidade do ambiente de mocks na concorrência, não por defeito confirmado do produto.

Para HTTP, usar instância **dedicada** do build em `127.0.0.1:3017`, configurada com `DATABASE_URL=postgresql://postgres:teste@localhost:54329/erp_genius_test`, segredo de autenticação exclusivamente local, `AUTH_TRUST_HOST=true`, `NEXTAUTH_URL=http://127.0.0.1:3017` e `WHATSAPP_LIVE` vazio. Rodar depois da suíte, nunca simultaneamente: `node scripts/auditoria/http.mjs`. O script cria usuário fictício, altera um país de teste, autentica, desativa o usuário e remove o arquivo que eventualmente conseguir enviar. Não imprime cookies. Iniciar o build pelo comando compatível com o modo standalone do projeto; a auditoria utilizou `next start` local, que emitiu aviso sobre esse modo.

Arquivos de resultados são snapshots da execução. Novas execuções os substituem. Não confundir a proporção de falhas desses cenários deliberadamente escolhidos com uma taxa geral de qualidade.
