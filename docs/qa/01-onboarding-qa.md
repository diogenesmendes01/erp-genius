# Onboarding do QA — ERP Genius (UAT v1)

Bem-vindo. Este guia é o seu ponto de partida. Siga na ordem: em um dia você deve estar com o
ambiente pronto e o primeiro ciclo de testes começado.

## 1. O que é o sistema

ERP de gestão escolar da Escola Genius: alunos e matrículas, financeiro, CRM de vendas com
WhatsApp, e área de configuração. Web, acessado pelo navegador. Hoje está na **Fase 0**: operação
manual ponta a ponta. Automações, IA e notificações ainda não existem (veja o que não testar em
[`auditoria-consolidada.md` §4](auditoria-consolidada.md)).

Fluxo principal de negócio, na ordem em que acontece:

1. **Lead** entra no CRM (manual ou via WhatsApp) → vendedor trabalha no pipeline → aula
   experimental → proposta.
2. **Matrícula**: vendedor converte o lead; aluno é criado; cobranças de taxa e mensalidades
   nascem.
3. **Financeiro**: pagamento registrado → matrícula ativa → aluno em turma → cobranças mensais,
   renegociação, aprovação de desconto, comissão do vendedor.
4. **Alunos**: ficha, turma, trocar turma, pausar, reativar, documentos.

## 2. Acessos que você vai receber

| Item | O que é | Quem entrega |
|---|---|---|
| URL do UAT | Domínio próprio do ambiente de homologação, versão 1 | Gestor, por canal privado |
| Usuários de teste | Um por papel, mais combinados. Lista em [`02-usuarios-e-papeis.md`](02-usuarios-e-papeis.md) | Senhas por canal privado. Nunca em issue, print ou chat aberto |
| Repositório GitHub | Leitura do código e abertura de issues. Você vai commitar só em `e2e/` | Convite do GitHub |
| GitHub Projects | Quadro de bugs | Mesmo convite |

Regras: **nunca** aponte nada para produção. O UAT tem banco próprio. O WhatsApp em UAT está em
modo simulado: nada é enviado de verdade, os envios ficam registrados no sistema.

## 3. Máquina

Você só precisa de navegador para o teste manual. Para o automatizado:

- Node.js 20 ou superior (`node -v`).
- Git.
- VS Code (ou editor de sua preferência) com a extensão "Playwright Test for VSCode".
- Clonar o repositório e seguir [`e2e/README.md`](../../e2e/README.md).

Não precisa instalar PostgreSQL nem rodar o sistema localmente: os testes rodam contra o UAT.

## 4. Ordem de leitura (primeiro dia)

1. Este guia.
2. [`02-usuarios-e-papeis.md`](02-usuarios-e-papeis.md): quem pode o quê.
3. [`03-roteiro-testes-manuais.md`](03-roteiro-testes-manuais.md): o que testar, na ordem.
4. [`04-fluxo-de-bugs.md`](04-fluxo-de-bugs.md): como reportar.
5. [`auditoria-consolidada.md`](auditoria-consolidada.md): o que já sabemos que diverge entre
   docs e código. Leia pelo menos §2, §3, §4 e §5.
6. Docs de produto, nesta ordem: [`../09-fase0-telas.md`](../09-fase0-telas.md) (telas),
   [`../07-papeis-permissoes.md`](../07-papeis-permissoes.md) (papéis),
   [`../10-regras-sistema.md`](../10-regras-sistema.md) (regras),
   [`../17-glossario.md`](../17-glossario.md) (termos).

Atenção: alguns docs de produto estão desatualizados em relação ao código. A lista está em
`auditoria-consolidada.md` §6. Quando doc e sistema discordarem, **o roteiro diz o que fazer**:
ou o comportamento esperado já está decidido, ou o cenário está marcado como "decisão pendente"
e você registra o observado sem abrir bug.

## 5. Como é um ciclo de teste

1. Pegue o roteiro e execute módulo por módulo, na ordem.
2. Para cada cenário registre: Passou, Falhou, Bloqueado ou Não aplicável.
3. Falhou → abra uma issue pelo template "Bug" (ver `04-fluxo-de-bugs.md`). Uma issue por bug,
   não por cenário.
4. Bloqueado → anote o que bloqueou e siga para o próximo módulo.
5. Ao fim do ciclo, entregue a planilha de resultados e um resumo curto (quantos cenários,
   quantos bugs por severidade, o que ficou bloqueado).

Primeiro ciclo: só manual. A partir do segundo, cada cenário P1 que passou vira candidato a teste
automatizado no Playwright.

## 6. O que fazer quando travar

- Não consegue logar: confira se a URL é a do UAT e se a senha é a de UAT (não a do seed de dev).
- Tela de "acesso negado": pode ser correto para aquele papel. Confira na matriz de
  `02-usuarios-e-papeis.md` antes de abrir bug.
- Matrícula com turma dá erro: é o bloqueador B1 da auditoria. Verifique com o gestor se a turma
  foi aberta no banco.
- Dúvida de regra de negócio: pergunte ao gestor e anote a resposta na issue ou no roteiro, para
  a próxima pessoa não ter a mesma dúvida.

## 7. Contatos e canais

| Para | Canal |
|---|---|
| Dúvida de regra, decisão de "é bug ou é assim mesmo" | Gestor (definir canal) |
| Bug | GitHub Issues |
| Senhas e acessos | Canal privado com o gestor |
