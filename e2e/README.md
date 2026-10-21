# Testes E2E (Playwright) contra o UAT

Testes ponta a ponta que abrem um navegador de verdade e usam o ERP Genius como um usuário.
Eles rodam **contra o ambiente UAT (homologação) já publicado**, pela URL. Não é preciso subir
o sistema, banco ou PostgreSQL na sua máquina.

> Os testes unitários e de integração do time de dev continuam no Vitest (`npm test`,
> `npm run test:int`). Eles não enxergam esta pasta e você não precisa mexer neles.

## Estrutura

```
playwright.config.ts      configuração (URL, navegador, evidências, relatórios)
.env.e2e.example          modelo das variáveis (copie para .env.e2e)
e2e/
  auth.setup.ts           loga uma vez com cada papel e salva a sessão em e2e/.auth/
  fixtures/usuarios.ts    e-mail e senha de cada papel, lidos do ambiente
  fixtures/auth.ts        login(page, papel) e o `test` com a opção { papel }
  login.spec.ts           ACE-01 login + menu por papel, ACE-02 senha errada, ACE-03 rota sem sessão
  permissoes.spec.ts      PER-NNx: papel X abre URL Y e recebe "Acesso negado"
```

## 1. Instalar (uma vez por máquina)

Pré-requisito: Node.js 20.12 ou superior (`node -v`).

```bash
npm install                         # instala as dependências do projeto (inclui @playwright/test)
npx playwright install chromium     # baixa o navegador usado nos testes
```

Recomendado: extensão **Playwright Test for VSCode** (roda e depura testes pelo editor).

## 2. Configurar o `.env.e2e`

```bash
cp .env.e2e.example .env.e2e        # PowerShell: Copy-Item .env.e2e.example .env.e2e
```

Abra o `.env.e2e` e preencha:

- `E2E_BASE_URL`: URL do UAT, sem barra no final (o gestor passa por canal privado).
- `E2E_PASSWORD_<PAPEL>`: senha de cada usuário de teste (também por canal privado).
- `E2E_EMAIL_<PAPEL>`: já vem com o padrão do seed; só altere se o UAT usar outros.

Papéis (`<PAPEL>`), com os apelidos do roteiro e o e-mail padrão do seed (`prisma/seed.ts` e
`prisma/seed-qa.ts`):

| `<PAPEL>` | Papel no sistema | E-mail padrão |
|---|---|---|
| `ADMIN` | Administrador | admin@genius.com |
| `ADMIN2` | Administrador (segundo, para decisões independentes) | admin2@genius.com |
| `GERENTE_COMERCIAL` | Gerente Comercial | gerente@genius.com |
| `VENDEDOR` | Vendedor | joao@genius.com |
| `VENDEDOR2` | Vendedor (segundo, outra carteira) | vendedor2@genius.com |
| `VENDEDOR3` | Vendedor sem limite de desconto | vendedor3@genius.com |
| `GERENTE_PEDAGOGICO` | Gerente Pedagógico | gp@genius.com |
| `GERENTE_PEDAGOGICO2` | Gerente Pedagógico (segundo) | gp2@genius.com |
| `PROFESSOR` | Professor | carla@genius.com |
| `PROFESSOR2` | Professor (segundo, outra turma) | professor2@genius.com |
| `FINANCEIRO` | Financeiro | financeiro@genius.com |
| `FINANCEIRO2` | Financeiro (segundo, aprova acertos) | financeiro2@genius.com |
| `SECRETARIA` | Secretaria Acadêmica | secretaria@genius.com |
| `VENDEDOR_PROFESSOR` | Vendedor + Professor no mesmo usuário (AC03 do doc 37) | venprof@genius.com |

Exemplo: `E2E_EMAIL_GERENTE_PEDAGOGICO2` e `E2E_PASSWORD_GERENTE_PEDAGOGICO2`.

O `playwright.config.ts` lê esse arquivo sozinho (recurso nativo do Node, sem pacote extra).
Se preferir não usar arquivo, defina as variáveis no terminal. O que está no terminal tem
prioridade sobre o arquivo:

```bash
# bash / Git Bash
export E2E_BASE_URL=https://uat.exemplo.com
export E2E_PASSWORD_PROFESSOR='...'
```

```powershell
# PowerShell
$env:E2E_BASE_URL = 'https://uat.exemplo.com'
$env:E2E_PASSWORD_PROFESSOR = '...'
```

Sem `E2E_BASE_URL` nada roda: o Playwright para com uma mensagem explicando o que falta. Sem a
senha de um papel, o setup daquele papel é **pulado** (aparece como `skipped`, com o nome da
variável) e só os testes que usam aquele papel falham, dizendo o que preencher. Assim um papel novo
ainda sem senha (ex.: `ADMIN2`) não trava o resto. Senha preenchida mas errada faz o setup falhar e,
nesse caso, nenhum spec roda: corrija a senha.

## 3. Rodar

| Comando | O que faz |
|---|---|
| `npm run test:e2e` | Roda tudo, sem abrir janela (headless). Primeiro o setup de login, depois os specs |
| `npm run test:e2e:ui` | Abre o modo UI: lista de testes, rodar um por um, ver cada passo e a tela |
| `npm run test:e2e -- --headed` | Roda mostrando a janela do navegador |
| `npm run test:e2e -- e2e/login.spec.ts` | Roda só um arquivo |
| `npm run test:e2e -- -g "PER-01"` | Roda só os testes cujo nome contém `PER-01` |
| `npm run test:e2e -- --debug` | Roda passo a passo com o inspetor do Playwright |
| `npx playwright test --list` | Só lista os testes encontrados, sem executar |

### Gravar um teste novo (codegen)

O codegen abre o navegador e escreve o código enquanto você clica. Passe a URL do UAT:

```bash
npm run test:e2e:codegen -- https://uat.exemplo.com/login
```

Use o código gerado como rascunho: troque seletores frágeis (classes CSS, posições) por
`getByRole`, `getByText` ou `input[name=...]`, e use o helper `login()` em vez de gravar o login.

## 4. Ler o resultado

- **Terminal**: cada teste aparece com ✓ (passou), ✘ (falhou) ou `-` (pulado / `fixme`).
- **Relatório HTML**: depois de rodar, abra com `npx playwright show-report`. Clique num teste
  para ver os passos, o erro, o print e o vídeo.
- **Trace** (o mais útil para investigar): quando um teste falha, o Playwright guarda um
  `trace.zip` em `test-results/<nome-do-teste>/`. Abra pelo relatório HTML (seção "Traces") ou com
  `npx playwright show-trace test-results/<pasta>/trace.zip`. Dá para voltar no tempo passo a
  passo e ver a tela, o console e as requisições de rede de cada momento.
- Ao abrir um bug, anexe o `trace.zip` (ver `docs/qa/04-fluxo-de-bugs.md`). Antes, confira se
  o print não mostra dado sensível.

Print, vídeo e trace só são guardados para testes que **falharam**.

## 5. Como funciona o login reaproveitado

1. O projeto `setup` (`e2e/auth.setup.ts`) roda antes de tudo: loga com cada papel que tem senha
   pela tela `/login` e salva os cookies em `e2e/.auth/<PAPEL>.json`.
2. Num spec, `test.use({ papel: "PROFESSOR" })` faz os testes daquele bloco começarem já logados
   como Professor, sem passar pela tela de login de novo.
3. Sem `test.use({ papel })`, o teste começa sem sessão (visitante), como em `login.spec.ts`.

Importe sempre `test` e `expect` de `./fixtures/auth` (não de `@playwright/test`), para ter a
opção `papel`.

## 6. Convenções

- **Um spec por módulo**: `login.spec.ts`, `permissoes.spec.ts`, e depois `crm.spec.ts`,
  `matricula.spec.ts`, `financeiro.spec.ts`, `alunos.spec.ts`...
- **Nome do teste começa pelo ID do roteiro** `docs/qa/03-roteiro-testes-manuais.md`, seguido de
  uma frase do que se espera. Assim o resultado do Playwright casa com o roteiro e com a issue de
  bug. Os IDs destes specs são **definitivos**:
  - `ACE-01` login com sucesso e menu lateral (roda uma vez por papel), `ACE-02` senha errada e
    e-mail inexistente, `ACE-03` rotas protegidas sem sessão (`/alunos`, `/financeiro`,
    `/configuracao/usuarios`, `/funil`);
  - `PER-NNx` permissões: `NN` é o papel (`01` Professor, `02` Vendedor, `03` Gerente
    Pedagógico, `04` Secretaria, `05` Financeiro; `06` a `08` são bugs conhecidos ou decisões
    pendentes) e a letra é a URL (`PER-01a`, `PER-01b`…).
  Novos specs seguem o mesmo padrão com o prefixo do módulo no roteiro.
- **Menu esperado** (`MENU_ESPERADO` em `login.spec.ts`): espelha o array `NAV` de `src/lib/nav.ts`,
  na mesma ordem (a Sidebar não reordena; a Home não é o primeiro item). Se o menu mudar, atualize
  junto.
- **Seletores**: prefira o que o usuário vê (`getByRole("button", { name: "Entrar" })`,
  `getByText(...)`, `getByRole("heading", ...)`). Evite classes CSS e XPath.
- **Esperas**: não use `page.waitForTimeout(...)`. Os `expect(...)` do Playwright já esperam o
  elemento aparecer (até 10 s).
- **Bug conhecido ou decisão pendente** (itens X e R de `docs/qa/auditoria-consolidada.md`, ex.:
  X2 Empresas no menu, X3 tela de erro em vez de "Acesso negado", R13 Configuração do Gerente
  Comercial): escreva o teste com o comportamento esperado e marque com `test.fixme(...)` e um
  comentário citando o X ou o R. Quando a correção for publicada ou o PO decidir, troque por
  `test(...)`, ajuste ou apague o caso.
- **Dados**: testes que criam registros (leads, matrículas) devem usar nomes identificáveis
  (ex.: prefixo `E2E `) para o time saber o que foi gerado pela automação.
- Comentários e nomes de teste em português.

## 7. O que NÃO fazer

- **Nunca aponte para produção.** `E2E_BASE_URL` é sempre o UAT. Os testes logam, clicam e
  (nos próximos specs) criam dados.
- **Nunca escaneie o QR code do WhatsApp no UAT** (nem à mão, nem num teste). Algumas ações da
  Inbox chamam o motor do WhatsApp direto, sem a trava `WHATSAPP_LIVE`; com um número conectado
  elas mandariam mensagem de verdade (bug X15 da auditoria consolidada).
- **Não espere o CI rodar estes testes.** O CI do repositório (`.github/workflows/ci.yml`) roda só
  typecheck, lint, testes unitários e build; ele **não** roda os E2E. Os E2E rodam na máquina do QA,
  contra o UAT, com o `.env.e2e` local.
- **Não commite o `.env.e2e`** nem nada de `e2e/.auth/` (senhas e cookies de sessão). Ambos
  estão no `.gitignore`; confira com `git status` antes de commitar.
- Não commite `playwright-report/` nem `test-results/` (também ignorados).
- Não coloque senha, token ou URL do UAT direto no código. Sempre pela variável de ambiente.
- Não cole senha nem trace com dado real em issue, print ou chat aberto.
- Não rode o ACE-02 (senha errada) em loop: depois de 5 falhas em 15 min o e-mail fica
  bloqueado temporariamente e o login daquele usuário para de funcionar.
- Não altere `vitest.config.ts` nem os testes em `src/` (são do time de dev).
