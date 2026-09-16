# Validação da implementação de acesso

Usar somente o PostgreSQL descartável `localhost:54329/erp_genius_test`.
As integrações apagam os dados fictícios entre cenários; executar uma suíte por vez.

```text
npm run test:db
npm test
npm run test:int
npx tsc --noEmit
npm run lint
npm run build
```

Para o smoke HTTP, iniciar uma instância dedicada do build em `127.0.0.1:3017`,
com `DATABASE_URL=postgresql://postgres:teste@localhost:54329/erp_genius_test`,
`AUTH_TRUST_HOST=true`, `NEXTAUTH_URL=http://127.0.0.1:3017`, segredo de autenticação
exclusivo de teste e `WHATSAPP_LIVE` vazio. Não executar cron/webhooks externos.
Rodar `node scripts/validacao/http-acesso.mjs` depois das integrações. O script
usa login real, cria apenas dados fictícios, verifica os checksums das migrations
aplicadas e grava `node_modules/.implementation/http-final.json`, sem imprimir cookies.

Os snapshots da auditoria original em `docs/auditoria-2026-09-*.json` são históricos;
não devem ser substituídos pelos resultados desta implementação.

Para conferir a retomada no navegador depois das integrações:

```text
node scripts/validacao/retomada-navegador.mjs preparar
```

O comando cria aluno, parcelas e dois usuários fictícios no mesmo banco descartável.
Os e-mails e os novos vencimentos são mostrados na saída; a senha de teste está no script.
Na instância local, entrar como Secretaria, pausar o aluno e enviar proposta de
reprogramação usando as datas indicadas. Sair e entrar como Financeiro, conferir e
aprovar a proposta na aba Retomadas. Então executar:

```text
node scripts/validacao/retomada-navegador.mjs verificar
```

A verificação lê o estado gravado e confirma retomada, aprovação independente,
preservação de IDs/saldos/recebimentos e aplicação dos novos vencimentos/ciclos.
O resultado fica em `node_modules/.implementation/retomada-navegador.json`.

Para conferir a mudança acadêmica depois das integrações:

```text
node scripts/validacao/academico-navegador.mjs preparar
```

O comando usa o mesmo banco descartável fixo e cria dados fictícios: aluno alocado
em A1, destino A2, matrícula paga e uma aula anterior. As contas de Secretaria,
Professor e Gerência Pedagógica aparecem na saída; a senha de teste está no script.
Na ficha acadêmica, Secretaria solicita mudança e confirma horário. Conferir que
o aluno ainda está na origem com `verificar-pendente`. Professor registra parecer;
Gestão aprova sem executar. Conferir com `verificar-aprovada`. Secretaria executa,
reconfirmando horário, e então rodar `verificar`:

```text
node scripts/validacao/academico-navegador.mjs verificar-pendente
node scripts/validacao/academico-navegador.mjs verificar-aprovada
node scripts/validacao/academico-navegador.mjs verificar
```

Os três comandos leem o estado, sem executar a mudança. Verificam autoria, estado,
alocação, aprovação independente e preservação de contrato, cobranças, recebimentos
e diário. Os relatórios ficam sob `node_modules/.implementation/academico-navegador*.json`.
