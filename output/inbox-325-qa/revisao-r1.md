# QA independente — PR417/#325 R1 em fd1ea7e

Favorável à correção de B1/C1 na fonte exata `fd1ea7e70e74af2e495c9f31582df2816b4b8ab2`, pai `29b237632923c583e76952835c7855ab91308293`, árvore `eddd2b447b0560690906dd720c0ba5580fdbc64d`. Não encontrei novo bloqueador no código revisado ou recortes executados. CI/publicação/revisão humana permanecem separados deste parecer; não houve recaptura ou homologação visual nova.

## Escopo e preparo

Review R1 `5638982397` da PR417 foi lida pelo conector GitHub, com corpo REQUESTCHANGES no head29b23763; nenhuma thread inline foi retornada. B1 descrevia a perda do DTO/link/foco a cada versãoSSE. C1 apontava a ausência de telefone comercial semPessoa. Não executei as sugestões cegamente: distingui cache por contexto de cache por aquisição, revogação explícita de falha transitória e telefone previamente autorizado de nova leitura/permissão.

Preflight/checkout `de4121` EXIT0 no worktree TESTER exclusivo:1.060 arquivos output privados untracked+ignored inventariados, excluindo documentos tracked que legitimamente mudam no checkout. Sem reset/limpeza; HEAD detached/tracked limpo. Perfilintegracao, schema487 OID `1f575691cde242124c1493b8406121e8830a6f7e`, client físico SHA `e24658b28818cf2bd124071f3ea41c7682b03581de9bb27a1ea122388e297200`. Runtime só começou após ROOT Next/READY `66df51` EXIT0. NenhumDB/INT, HTTP real, browser, UI, Save, nota, Prisma/generate, instalação ou alteração de ambiente pelo TESTER.

Diff7 paths=4SRC+3MD. Sem delta contra o pai em backend, lib, componentes compartilhados, Prisma/SQL/schema, scripts/harness, package/locks ou workflows. Manifesto `inbox-325-pr417-r1-fontes-tester.json` registra quatro blobs/SHA GitLF, logs e identidade; executor `b48b88` EXIT0/SHA `9740c3ca612563547309bef209407cfa18bfc23a23fe231b52eb91c929f11aa1`. Os1.060 privados conferem hash por hash, incluindo pareceres anteriores; fonte permaneceu congelada/tracked limpo.

## Gates próprios observados

Node22.23.2 local/Vitest4.1.11, executáveis/dependências existentes. Nenhum filtro por nome ou skip imposto. Configuração unitária padrão exclui integração. Não é regressão global.

| Gate | Sessão/terminal | Resultado |
| --- | --- | --- |
| Causal3 completos, lista abaixo | b00436 | EXIT0,47 testes,2,41s,maxWorkers2 |
| Ampliado8 completos, lista abaixo | 5af1a6 | EXIT0,163 testes,3,82s,maxWorkers2 |
| ESLint quatro paths do diff | 73090b | EXIT0,zero avisos,teto0 |
| TypeScript completo | 87087/b6abf9 → 0f7f34 | EXIT0,sem diagnóstico,heap8192/incrementalfalse |
| diff-check HEAD^..HEAD | b48b88 | EXIT0 |

Os oito incluem os três causais: não são210 testes distintos. A lista causal própria difere do ROOT3/33 e não recebe essa contagem por herança. TSC foi acompanhado na mesma sessão até terminal0, sem interpretar silêncio como sucesso. Comandos (`node` = executável absoluto fornecido pelo ROOT):

```powershell
node node_modules/vitest/vitest.mjs run 'src/app/(app)/inbox/abas/useAbaPainel.test.ts' 'src/app/(app)/inbox/InboxNovo.detalhes.test.ts' 'src/app/(app)/inbox/InboxNovo.test.ts' --maxWorkers=2
node node_modules/vitest/vitest.mjs run 'src/app/(app)/inbox/abas/useAbaPainel.test.ts' 'src/app/(app)/inbox/InboxNovo.detalhes.test.ts' 'src/app/(app)/inbox/InboxNovo.test.ts' 'src/app/(app)/inbox/InboxNovo.interacao.test.ts' 'src/app/(app)/inbox/InboxNovo.foco.test.ts' 'src/app/(app)/inbox/abas/AbaDetalhes.test.ts' 'src/app/(app)/inbox/PainelContato.test.ts' 'src/app/(app)/inbox/PainelContato.interacao.test.ts' --maxWorkers=2
node node_modules/eslint/bin/eslint.js 'src/app/(app)/inbox/InboxNovo.detalhes.test.ts' 'src/app/(app)/inbox/InboxNovo.tsx' 'src/app/(app)/inbox/abas/useAbaPainel.test.ts' 'src/app/(app)/inbox/abas/useAbaPainel.ts' --max-warnings=0
# NODE_OPTIONS=--max-old-space-size=8192 somente na shellTSC:
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

Logs privados: `inbox-325-pr417-r1-causal-tester.log`481B/SHA `1d8b7990719652f3fa7136bf0eaf1c090020af5a6294a4185106d9b153a95c50`; `inbox-325-pr417-r1-ampliado-tester.log`483B/SHA `b5266e9a943337b266e845588eae9eb69871716bf3e93ebd67f5ee9eee2db1e7`. Vite informou seu aviso de paths já existente; nenhum teste falhou nesta QA. Lint/TSC têm prova terminal, sem log bruto fictício por stdout vazio.

## Inspeção e oráculos

O hook separa identidade `[atendimentoId,aba]` da chave de aquisição `[atendimentoId,aba,versao,tentativa]`; ativofalse/idnull não têm identidade. Versão/retry do mesmo contexto conservam último DTO bom enquanto o novoGET conclui; resposta vigente200 o substitui. Cache não é um mapa global deIDs que reapareça ao voltar. Troca de contexto limpa por atualização condicionada no render, ocultando imediatamente valor incompatível; cleanup/AbortController+vigente removem autoridade da resposta antiga. A→B→A, troca de aba, desativar/reativar, SSR e StrictMode são cobertos pelos testes existentes.

Erro de aquisição inicial segue explícito. Com DTO bom,500/rede/JSON preservam dado e errofalse; não viram ausência legítima.403/404 vigentes removem o DTO e dão errotrue. No retry posterior o armazenamento já contémnull: uma500 preserva somente esse null e errotrue, portanto não recupera o DTO revogado. Esta última sequência composta403/404→500 é conclusão estática do fluxo, NÃO uma asserção encadeada executada: a suíte existente verifica revogação e transitórios separadamente. Não fabriquei teste, saída ou cobertura literal ausente.

O teste de composição dispara o callback de aviso `atendimento.atualizado` recebido pelo mock de transporteSSE, com InboxNovo/casca/abas/hook reais e conversa/escritas mockadas. Verifica a identidade do mesmo nóhref/foco enquanto GET está pendente e depois500; o teste do hook também conserva nó/foco e substitui texto na resposta nova200. Isso é integração ReactDOM no DOM mínimo, não SSE de rede real nem prova de geometria/eventos nativos do browser. Nenhuma nova captura foi atribuída a esse teste.

FallbackC1 usa somente `atual.contatoTelefone`, já recebido na lista autorizada. O ramo novo exige comercial semgrupo e DTO com `pessoa===null`; undefined durante carregamento não é tratado como ausência legítima. Não resolve Pessoa, monta nova query ou concede capacidadeCRM. Telefone ausente continua ausente. Fora do comercial/grupos o comportamento anterior é mantido. Os testes reais verificam ausência de perfil inventado e telefone não fabricado, além da composição B2B/links por capacidade e fora do comercial.

C3Documento da empresa permanece justificado pela fixtureRUT/LATAM; C5 já tem negativos explícitosCPF/Idade/Preferências e ausência de perfil/ficha no caso semPessoa em AbaDetalhes.test.ts, agora também incluído no recorte ampliado. C4destinoFunil continua contrato provisório325; não implementa callback/aba327. C2remoto é tratado pelo ROOT na disposição documental, com corpus anterior nominalAPPddf/harness96c; este parecer não reaudita upload nem produz imagens daR1. Os hashes/negativos/limites do ZIP36 e sete pareceres anteriores não foram substituídos.

## Limites e handoff

RED58d5bd/6 falhas causais e GREENROOTe76b84/3/33, global21939/026749/926arquivos7309testes e TSC71274/3f8f09 são provas ROOT, não minhas. Interrupções intermediárias63523/e7e192 e5623/ec8ae1 continuam sem gate verde atribuído. Não há novo negativo próprio de produto nesta execução.

Backend/schema/harness idênticos ao pai tornam desnecessária nova INT para esta alteração de produtor/apresentação; não reutilizei o banco liberado/restaurado após326. Correção do hook deve ser portada de forma exata às composições326/327 e receber a atribuição correspondente; a QA326 anterior2b43 não cobre automaticamente esse produtor modificado. Nenhum novo Save/HTTP/UI autorizado por este parecer. CI no novo head, revisão do PR, publicação e decisão humana de encerramento são próximos passos do integrador.
