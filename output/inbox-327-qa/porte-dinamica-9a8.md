# QA independente do porte #327 R2 — código integrado

Parecer favorável ao recorte dinâmico no commit exato 9a8ebc81fe59eb978a219443485952d56ab83bbe, base74d4dbc67fd1d9c3750633029f4141c8cbcfc597. Não encontrei regressão nova no recorte próprio de UI, produtor, transações e harness. A prova atual complementa a congruência estática entregue antes dos gates; não substitui CI, não produz novas capturas e não fecha a interface #328.

## Ambiente, comandos e terminais próprios

ROOT79317f preparou o worktree exclusivo inbox-tester, branch codex/inbox-e2-327-port-r2-qa, perfil tester, cliente490 próprio e TESTER491 restaurado em8860b5, snapshotf1d15dff/424hashes/1.392registros. Préflight db4102 confirmou HEAD/perfil/cliente; o hash físico próprio do schema do cliente é647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b. Tracked permaneceu limpo e todos os privados anteriores foram preservados. Não instalei, gerei cliente, executei DDL ou alterei perfil/cluster/checkout de outro agente.

Node22 local: C:/Users/Mendes/AppData/Local/hermes/node/node.exe. Comandos no próprio worktree:

```text
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/inbox/painel-oportunidades.int.test.ts src/server/inbox/painel-oportunidades-pool1.int.test.ts src/server/inbox/acoes-painel-etapa.int.test.ts src/server/inbox/acoes-painel-perda.int.test.ts src/server/inbox/acoes-painel-perda-pool1.int.test.ts src/server/comercial/experimental-perda-idempotencia.int.test.ts src/server/comercial/leads.int.test.ts --maxWorkers=1
node node_modules/vitest/vitest.mjs run src/server/inbox/painel-abas.test.ts src/server/crm/etapas.test.ts 'src/app/(app)/inbox/InboxNovo.foco.test.ts' 'src/app/(app)/inbox/InboxNovo.interacao.test.ts' 'src/app/(app)/inbox/InboxNovo.detalhes.test.ts' 'src/app/(app)/inbox/PainelContato.test.ts' 'src/app/(app)/inbox/PainelContato.interacao.test.ts' 'src/app/(app)/inbox/abas/AbaOportunidades.test.ts' 'src/app/(app)/inbox/abas/etapas-painel.test.ts' 'src/app/(app)/inbox/abas/AbaDetalhes.test.ts' 'src/app/(app)/funil/ModalPerda.acao.test.ts' src/test/visual-inbox-oportunidades.test.ts src/test/visual-inbox-integracao-oportunidades.test.ts src/test/visual-inbox-coletor-oportunidades.test.ts src/test/visual-inbox-cli-oportunidades.test.ts src/test/visual-inbox-estados.test.ts src/test/visual-inbox-estados-fluxo.test.ts --maxWorkers=2
```

UNIT: sessão92260/início09b20f/terminalaaa8b4 EXIT0,17 arquivos completos/460testes,9,22s,w2. INT: sessão9809/início3b358c/terminalf90840 EXIT0,sete arquivos completos/67testes,263,04s,w1. Sem filtros de nome ou skips. A mesma sessão INT foi observada até o terminal. As advertências vite-tsconfig-paths/MIXED_EXPORTS são de configuração, sem falhas de teste.

O log UNIT contém mensagens de “Capturas concluídas” e “FALHAS” dos doubles e contrafactuais do harness. São controles esperados dos testes que terminaram verdes; não constituem nova operação Playwright, corpus PNG, homologação visual ou execução nativa de18casos. Não abri browser, não fiz HTTP de produto, Save, perda/movimento manual, nota/envio real ou nova captura.

Liberei explicitamente TESTER491 ao ROOT imediatamente após f90840; nenhum outro executor DB estava ativo e não voltei ao banco. O restauro posterior cabe ao integrador e não é presumido por este parecer.

## Fonte e congruência preservadas

A prova estática anterior, inbox-327-port-r2-9a8-final-review-tester.md, tem7.855bytes/SHA256 ec29a5a011718b4a53449a8f07d252380ef2bedf983ebf987168b37238277a09. Seu JSON de identidade tem22.086bytes/SHA256 b72e2155a75d5ff6cf81f23a30d9ece9b5dc482d884d33344a515e096848ff25. Mantém o escopo declarado3.530objetos,3.509não selecionados exatos e45selecionados,40literais cfa mais cinco exceções justificadas. Scripts fora de visual42 e workflows também foram conferidos separadamente. Não transformo esse escopo em uma alegação de identidade universal de todo diretório histórico.

As sete funções de acoes-painel e imports são literais cfa; a diferença de arquivo é só um separador vazio. InboxNovo mantém o OR420 correto: (detalhesComerciais && abaAtiva === detalhes) || editorAberto. O teste de foco acrescenta somente quatro defaults343. As outras exceções são adendos da SPEC de fundação328 e do README que distingue CLI do wrapper restritivo. Main337, Compositor, Sino, whatsapp, labels, schema/deps, núcleos953, Detalhes325 e editor326 ficam protegidos contra o porte histórico indiscriminado.

Após os terminais, o verificador próprio d0ec68 EXIT0 conferiu novamente os45selecionados físicos normalizados contra seus bytes/SHA GitLF, HEAD, perfil, cliente e tracked limpo, sem usar banco. Evidência final: output/inbox-327-port-r2-gates-tester.json,10.064bytes/SHA256 026776658a4f624289c98b9766a892be7c74aaacd43eb9b468bd34ef1e2557bb. O JSON também registra hashes dos logs e referências dos terminais.

O filho documental346ec2e7e687db74f23febf64ac25c53e3205bf4 foi inspecionado somente por Git em0c7343: quatro documentos mudam, sem delta em src/scripts/prisma/packages/workflows. Não troquei o checkout para esse filho nem reatribuo a ele uma execução própria diferente; os testes são nominais ao9a8, cuja fonte executável foi preservada.

## Contratos e oráculos relevantes

O loader autoriza o atendimento antes de resolver a oportunidade. Fora da thread retorna null; ausência legítima comercial, outro setor ou falta de contexto retorna DTO vazio sem dados comerciais. A oportunidade principal vem de leadId do atendimento, não de pessoaId do Contato. Sem Pessoa, a oportunidade atual continua disponível; não se usa o interlocutor como fallback para “outras”. Valores nulos e zero, moeda ausente, país, responsável e professor permanecem projeções explícitas serializáveis.

D13 permite ao convidado vigente ler a oportunidade da própria thread. Esse convite não concede carteira das outras oportunidades da Pessoa nem escrita. Outras são filtradas pela carteira antes do take10, excluem a atual e usam criadoEm/idDESC estáveis. Revogação do convite retira a leitura; dono da linha sem autorização comercial não recebe a oportunidade. Os arquivos próprios completos exercitam esses caminhos com fixture real, além do Db fornecido em pool1.

O wrapper de mutação resolve o alvo autorizado pela thread. oportunidadeIdEsperada é somente precondição CAS, nunca alvo arbitrário de WHERE. Trava Atendimento, lê ator/escopo/contexto atuais, trava Lead e revalida novamente antes do núcleo. A cópia do ator não altera a sessão memoizada. As corridas reais de troca de lead, carteira revogada, papel revogado e usuário inativo durante espera do lock são recusadas, sem Evento/movimento indevido.

Movimento manual usa a máquina de estados existente. Proposta, experimental, matrícula e perda exigem seus fluxos próprios; não viram mudança direta pela barra. Encerradas recusam retorno. Repetir a mesma etapa é no-op sem Evento/aviso, e movimentos simultâneos iguais serializam com uma alteração. Rollback após avisar desfaz etapa/Evento e não libera NOTIFY; o teste usa sentinela para observar o barramento sem atribuir silêncio isolado a sucesso.

Perda usa o núcleo transacional compartilhado e o mesmo contexto CAS. Falha desfaz alteração/Evento/aviso; repetição compatível preserva idempotência, e o caminho antigo do Funil continua coberto. A assinatura opcional do ModalPerda permite ação do Inbox sem chamar a ação global nem router.refresh; sem a prop, o caminho antigo é mantido. Validação de Outro/observação e erros de negócio/transporte conservam formulário e feedback.

Na UI, Detalhes e editor compartilham o produtor e seu contexto; isso não significa uma única requisição por toda a vida da tela. Revalidações/versões e troca de aba podem exigir nova aquisição. A composição preserva o cacheR1 e não limita o editor pelo gate comercial da aba. A aba Oportunidades usa seu produtor próprio; Atividade permanece sem dados e não foi antecipada.

Os testes atuais do owner de perda incluem op1→op2 conhecido→pending→op1 sem clique, ausência legítima da oportunidade, loading da mesma identidade com rascunho, nova aberturaop2 e ACK antigo deop1. Identidade conhecida diferente encerra a sessão em vez de só esconder o modal; loading não a ressuscita. ACK antigo não fecha nem reconcilia o novo rascunho. Escape/resize e um único modal no celular são exercitados pelo componente/hook reais com o restante de rede/thread mockado. Esses oráculos não são uma nova medição de foco em navegador nativo.

Harness completo de oportunidades e integrações/CLI/coletores entrou no recorte. A fronteira específica Details→Oportunidades, os controles de recuperação953, DOM/proveniência e falhas conservadoras foram executados nos seus testes existentes; isso não autoriza um wrapper histórico com pins/READY antigos contra a árvore integrada nova.

## Limites, históricos e atribuição

Os sete INT incluem os três próprios327 e a fundação compartilhada de perda/legado. O total67 não fecha #328: interface, cartão, fluxo completo e aceite específico de328 continuam fora deste porte. Não dupliquei a regressão global947/7.742 do DEV, nem TSC original5350/2c07e3 ou lint43/1bebe7. Esses gates e a INTDEV7/67 em84101/84d73d são provas separadas informadas pelo integrador/DEV, não minhas execuções nem parcelas para somar.

O corpus visual permanece composto e histórico: seis APPadmin A7 nominais9480/APP EBF, seis PROTO A9 nominaisbe45 e seis APPleitor A11 nominaiscfa. As qualificações de reuso A7 e o adendo de ancestralidade continuam explícitos, sem checks novos retroativos, relabel de fotos, retro-selo ou alegação de um único run18 do9a8. A7/A8/A9/A10/diagnósticos negativos não são reclassificados. Nenhuma prova visual nova do Main+327 foi produzida nesta QA dinâmica.

Os nomes inferidos output/inbox-327-report.md e output/inbox-327-port-r2-report.md não existiam no9a8, gerando as leituras administrativas db4102/c1ef42 negativas; o relatório de porte só entrou depois no filho346ec. Preservei esses resultados sem alterar fonte ou escolher outro SHA para os testes. A préflight de identidade estava correta e foi reconfirmada ao final.

A estática da PR426 foi feita paralelamente apenas por Git e entregue em parecer separado72f5146c; não participa dos resultados327 e não acessou banco. CI, revisão final da composição/publicação, documentos e anexos pendentes do420 continuam sob ROOT, sem GO merge presumido. Este parecer não amplia autorização de UI, Save, integrações externas ou uso posterior do banco.
