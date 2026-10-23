# #321 — aviso transacional e capacidades do painel

Implementação nominal: `9d0225b4da449159e755448945bc1c89f1b61355`.
Composição verificada pelo integrador: `cea66f08343fe1b79ef14d70f8e17a88b3195ffd`,
com #321, #322 e a correção B2 já incorporada à main
`b6b451a37fe728280fd0899058344f32780ebaba`.

O PR individual conserva literalmente os objetos de produção e Prisma da fonte
#321. O produtor, schema e migrations da #322 ficam em seu PR separado. Os
resultados globais abaixo pertencem à composição cea; não são atribuídos a uma
execução global independente da branch individual.

## Evidências observadas

| Origem/fonte | Verificação | Resultado terminal |
|---|---|---|
| DEV /9d | Unitários dirigidos | 3 arquivos/77 testes, saída0 |
| DEV /9d | Cliente/SSR e matrizes | 14 arquivos/193 testes, saída0 |
| DEV /9d | Integração em dev-email | 4 arquivos/26 testes em duas execuções sequenciais, saída0 |
| DEV /9d | TypeScript/lint dirigido | saída0; lint sem avisos |
| TESTER /9d | Revisão exata independente | favorável; 3 arquivos/77 unitários, 3/30 cliente e 2/8 integração, saída0 |
| ROOT /9d | Bundle real e hidratação de /inbox | sessão18982, saída0; 6 contextos/3 tamanhos/2 temas |
| ROOT /cea | Unitário global | sessão57484, saída0; 904 arquivos/7118 testes/444,35s; maxWorkers2 |
| ROOT /cea | TypeScript após next typegen | sessão98957, saída0; heap8192 |
| ROOT /cea | ESLint global | sessão91254, saída0; 0 erros/40 avisos existentes |
| ROOT /cea | Integração inicial | sessão95770, saída0; 5 arquivos/66 testes/396,03s |
| ROOT /cea | Integração complementar | sessão40708, saída0; 3 arquivos/22 testes/137,82s |

A primeira chamada de integração incluiu três caminhos incorretos no módulo
inbox. Eles não foram executados e não contam nos cinco arquivos acima. O
complemento executou os três arquivos completos nos caminhos reais do módulo
whatsapp, em sequência no mesmo banco descartável. As duas execuções juntas
cobrem oito arquivos/88 testes. Este recorte não é a suíte de integração global.

O teste de bundle abriu a página autenticada fictícia pelo harness público,
aguardou conteúdo e hidratação e manteve as guardas de erros React/rede. O HTTP
307 de um acesso não autenticado, isoladamente, não é a prova de bundle. Não há
UI nova nesta issue; as seis capturas são diagnóstico local e não constituem
nova matriz formal app × protótipo. Sem transporte externo ou envio de mensagens.

A importação direta de `_shared/sessao` preserva a mesma classe de erro e evita
arrastar o barrel de eventos/Prisma para o grafo cliente. Matrizes de papéis e
regras de envio/escopo permanecem as existentes. D1 aprova o vendedor responsável;
o contexto de responsabilidade e autorização será entregue em #354. `veLead`
não prova responsabilidade nem autoriza mutações por si só.

## Operação e limites

O banco A foi restaurado após os testes e o bundle: 424 hashes/551 registros
originais conferidos (ROOT5bd8d7, saída0). O banco TESTER foi restaurado após a
QA nominal (ROOTd3bf75, saída0; 424 hashes/1386 registros). Depois ele recebeu
schema #322 em outra janela coordenada; os snapshots E1 não restauram esse schema.

B2 foi expressamente autorizada pelo usuário, validada em revisão própria e
incorporada em #392. Manifesto/lock da composição são iguais à main B2. O harness
atual conserva seus 20 estados/164 capturas e ganha apenas PW_CHROMIUM explícito;
não foram restaurados scripts antigos por causa dos conflitos de merge.

SPEC: `docs/specs/inbox-aviso-capacidades-painel.md`. Relatório DEV:
`output/inbox-321-report.md`. Parecer independente:
`output/inbox-321-review-tester.md`.
