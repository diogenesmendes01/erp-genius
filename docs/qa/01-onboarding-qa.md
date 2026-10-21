# Onboarding do QA — ERP Genius (UAT v1)

Bem-vindo. Este guia é o seu ponto de partida. Siga na ordem: em um dia você deve estar com o
ambiente pronto e começando o primeiro ciclo de testes.

## 1. O que é o sistema

ERP de gestão escolar da Escola Genius, acessado pelo navegador. Hoje cobre:

| Módulo (menu) | O que faz |
|---|---|
| Funil, Carteira, Contatos, Tarefas, Relatórios | CRM de vendas: oportunidades, equipe comercial, metas |
| Inbox | Atendimento por WhatsApp (em UAT, modo simulado) |
| Matrículas (Secretaria), Envios do portal | Entrada comercial, reserva, admissão, contrato, convite do portal |
| Alunos | Ficha, movimentações com aprovação, créditos, documentos |
| Mudanças acadêmicas, Diário de aulas | Avaliações, correções, segunda chamada, recuperação, fechamento; chamada, reposições, gravações |
| Financeiro, Comissões, Permutas | Cobranças, pagamentos, descontos com alçada, aprovações, comissões |
| Empresas | Cadastro B2B (fatura única e lote desligados) |
| Agente de IA | Aria, atendimento automático comercial (em UAT, provedor simulado) |
| Configuração | Operação, países, catálogo e preços, turmas, usuários, modelos contratuais, WhatsApp, CRM |
| Portal do aluno | Área do aluno: resultados, reposições, preferências |

Fluxo principal, na ordem em que acontece:

1. **Oportunidade** entra no Funil → vendedor trabalha → aula experimental → contratação.
2. **Entrada comercial**: preparação → reserva de vaga → admissão → contrato (prévia, original,
   assinatura) → matrícula ativa → cobranças iniciais.
3. **Vida acadêmica**: turma com grade e calendário → encontros → chamada → avaliações →
   oficialização → fechamento → resultado no portal.
4. **Financeiro**: cobranças mensais, informe e confirmação de pagamento, descontos com aprovação,
   comissões, continuidade.

## 2. Antes de você começar: o que o gestor precisa ter feito

O ambiente de UAT não fica pronto só com o deploy. Há um checklist de 19 passos em
[`auditoria/09-configuracao-ambiente-uat.md`](auditoria/09-configuracao-ambiente-uat.md), seção
"Dados mínimos do UAT", e oito bloqueadores conhecidos em
[`auditoria-consolidada.md` §2](auditoria-consolidada.md). Os que mais afetam o seu trabalho:

| Bloqueador | O que significa para você |
|---|---|
| B2 assinatura de contrato sem simulado | Nenhuma matrícula do fluxo novo chega a "Ativa" até o dev entregar um driver simulado. |
| B3 pagamento simulado desligado | Pagamento em UAT é informe da Secretaria + confirmação do Financeiro, ou recebimento direto. |
| B4 portal do aluno sem e-mail simulado | Sem link de ativação não há como entrar no portal. O gestor decide como você recebe o link. |
| B5 gravação exige Google Drive | Aula só fica "Ministrada" pela exceção de gravação, aprovada por outra pessoa. |
| B7 seeds não montam o ambiente | Sem a configuração mínima, a Home do gerente fica vazia e todo desconto vai para aprovação. |

Se ao começar você encontrar um desses, marque o cenário como **Bloqueado (B#)** e siga. Não abra
bug: já está mapeado.

## 3. Acessos que você vai receber

| Item | O que é | Quem entrega |
|---|---|---|
| URL do UAT | Domínio próprio do ambiente de homologação. Confira a versão em `/api/health` (campo `sha`). | Gestor, por canal privado |
| Usuários de teste | Um por papel, mais combinados. Lista e apelidos em [`02-usuarios-e-papeis.md`](02-usuarios-e-papeis.md) | Senhas por canal privado. Nunca em issue, print ou chat aberto |
| Repositório GitHub | Leitura do código e abertura de issues. Você só commita em `e2e/` | Convite do GitHub |
| GitHub Projects | Quadro de bugs | Mesmo convite |
| Caixa de e-mail de teste | Se o gestor optar por e-mail real de teste para o portal (B4) | Gestor |

Regras: **nunca** aponte nada para produção. **Nunca escaneie o QR do WhatsApp** em Configuração ›
WhatsApp: algumas ações da Inbox não passam pela trava de modo simulado e sairiam de verdade. O
UAT tem banco próprio.

## 4. Máquina

Você só precisa de navegador para o teste manual. Para o automatizado:

- Node.js 20 ou superior (`node -v`). O repositório tem `.nvmrc` com a versão.
- Git.
- VS Code com a extensão "Playwright Test for VSCode".
- Clonar o repositório e seguir [`e2e/README.md`](../../e2e/README.md).

Não precisa instalar PostgreSQL nem rodar o sistema localmente: os testes rodam contra o UAT. A CI
do repositório não roda os testes E2E; eles rodam na sua máquina.

## 5. Ordem de leitura (primeiro dia)

1. Este guia.
2. [`02-usuarios-e-papeis.md`](02-usuarios-e-papeis.md): quem pode o quê, apelidos usados no roteiro.
3. [`03-roteiro-testes-manuais.md`](03-roteiro-testes-manuais.md): o que testar, na ordem.
4. [`04-fluxo-de-bugs.md`](04-fluxo-de-bugs.md): como reportar.
5. [`auditoria-consolidada.md`](auditoria-consolidada.md): bloqueadores (§2), bugs prováveis (§3),
   decisões pendentes (§4), o que não existe (§5) e o que parece bug mas não é (§6).
6. Docs de produto, só quando precisar entender uma regra: as SPECs em `docs/specs/` são a fonte
   normativa (critérios MAT-, DOC-, ACA-, LC-). Os docs numerados de 01 a 32 são a especificação
   original e estão desatualizados em vários pontos (ver `auditoria-consolidada.md` §7).

Quando doc e sistema discordarem, **o roteiro diz o que fazer**: ou o comportamento esperado já
está decidido, ou o cenário está marcado como "decisão pendente (R#)" e você registra o observado
sem abrir bug.

## 6. Como é um ciclo de teste

1. Pegue o roteiro e execute módulo por módulo, na ordem. A ordem importa: a configuração do
   Módulo 1 e a preparação acadêmica do Módulo 2 alimentam todos os outros.
2. Para cada cenário registre: Passou, Falhou, Bloqueado ou Não aplicável.
3. Falhou → abra uma issue pelo template "Bug". Se o roteiro marca 🐞 X#, cite o X# na issue.
   Uma issue por bug, não por cenário.
4. Bloqueado → anote o B# ou o motivo e siga para o próximo módulo.
5. ⚠️ R# → registre o que viu na planilha, na coluna Observação. Não abra bug.
6. Ao fim do ciclo, entregue a planilha de resultados, a lista de issues abertas e um resumo
   curto por módulo.

Primeiro ciclo: só manual. A partir do segundo, cada cenário P1 que passou vira candidato a teste
automatizado no Playwright, com o mesmo ID.

## 7. O que fazer quando travar

- Não consegue logar: confira se a URL é a do UAT e se a senha é a de UAT. Se o e-mail do usuário
  tem letra maiúscula, é o bug X1: use um usuário com e-mail todo em minúsculas e abra a issue.
- Tela de "Acesso negado": pode ser correto para aquele papel. Confira na matriz de
  `02-usuarios-e-papeis.md` antes de abrir bug. Se aparecer "Não foi possível carregar esta tela"
  em vez de "Acesso negado", é o bug X3.
- Ação pede "outra pessoa" para aprovar: é a regra. Use o segundo usuário do mesmo papel (ADM-2,
  GP-2, FIN-2), nunca o Admin como atalho.
- Chamada não abre: ela só abre depois do fim real do encontro. Peça ao dev a modalidade curta
  de UAT.
- Dúvida de regra: pergunte ao gestor e anote a resposta na issue ou no roteiro.

## 8. Contatos e canais

| Para | Canal |
|---|---|
| Dúvida de regra, "é bug ou é assim mesmo" | Gestor (definir canal) |
| Passo que só o dev faz ([DEV] no roteiro: abrir turma no banco, disparar cron, simular webhook) | Dev de plantão (definir canal) |
| Bug | GitHub Issues |
| Senhas e acessos | Canal privado com o gestor |
