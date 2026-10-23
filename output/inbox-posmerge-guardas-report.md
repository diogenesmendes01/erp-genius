# Follow-ups pós-merge — guardas380, paleta381, selo396

Base exata autorizada4829a27424c2cf6091f5f7c5ea545a888fc0be06. Branch própria codex/inbox-review-posmerge-guardas. Inventário remoto prévio privado congelado com SHA2562d44a26f08cd48b91f8b643ea8a64fb2c7371b060c0be0502c6ff111c07d68aa; corte MAIN8c079d49,69itens/108mapeamentos de16reviews. Esse inventário não foi versionado nem transforma filaROOT em main.

## Escopo e contratos

- PR380C3: caminhos do índice Git, com separador NUL, recusam colisão de caixa em caminho completo. Fixture adversarial cria repo/indexGit temporário com dois nomes sem exigir materialização no Windows. Cleanup exige caminho absoluto resolvido cujo pai é a base temporária conferida, antes de rmSync somente da fixture. Sem alteração do índice principal pelo teste.
- LF: apenas src/**/*.ts, src/**/*.tsx e .github/workflows/ci.yml. A trava ci-workflow lê esse YAML e já normaliza CRLF defensivamente; essa proteção permanece. Regras CLI/deploy/migrations preservadas, sem git add --renormalize nem mudança em massa.
- PR381C2: remove somente offset de NAO_E_COR.ring. Teste existente recusa ring-offset vazio, conserva ring-offset-white e ring-offset-2; regex/limites/cores atuais intactos.
- PR396C3: custo de resync tardio e recontagem pessoal por montagem avaliado explicitamente na SPEC. SnapshotSSR pode anteceder stream aberto; leitura pessoal pode não gerar NOTIFY. Mantidos freshness e pedidos redundantes atuais, sem afirmar consolidação/cancelamento ou otimização não demonstrados.
- PR396C4: pedido final do integrador/plano é REMOVER contarNaoLidas, não apenas @deprecated. Busca completa src/scripts/barrel mostrou somente declaração e duas assertivas/import de linha-comercial.int.test. Removidas cinco linhas da função de soma compartilhada; barrel export* não exige mudança. Teste passa à consulta pessoal real contarConversasNaoLidas, preserva0/1 e demais assertivas. Nenhuma ACL, endpoint, produtor, selo ativo ou escrita alterados.
- PR396C5: três testes ReactDOM reais cobrem hook+singleton reais, EventSource falsa sem rede, callbacks atuais, estados, dois consumidores/uma fonte, desmontagem, StrictMode e falta de transporte. Testes históricos do helper preservados. Nenhum runtimehook/SSE/loja/props mudou.

## RED e GREEN observados

|Execução|Fonte/recorte|Resultado terminal|
|---|---|---|
|887408|Guarda inicial sensível à caixa e atributos antigos; indexGit temporário/diretórios/LF|exit1,3falhas/1passe causais|
|00f568|Guarda final e atributos exatos|exit0,1arquivo/4testes|
|526623|Paleta com nova asserção no caso existente, isenção offset antiga|exit1,1falha/7passes|
|ad7ecb|Hook real novo, sem mutação|exit0,1arquivo/3testes|
|b2a28e|Mutação temporária callbackRef congelado por effect[], transporte falso|Vitest exit1,1falha/2passes; finally restaurou bytes originais. Wrapper exit0 confirma falhaesperada+restauro, não GREEN do teste|
|26e18f|Guardas/helper/hook/SSE/CI dirigidos após correções|exit0,6arquivos/49testes|
|91114|Guardas AST ampliadas+hook/SSE/selo/CI|exit0,11arquivos/367testes,39,26s|
|79557|TypeScript noEmit/incremental, heap8192, buildinfo privado|exit0|
|e3e9e8|ESLint dos6fontes alterados/adicionados|exit0,semavisos|
|30761|linha-comercial.int.test completo, configintegration/maxWorkers1|exit0,1arquivo/24casos,86,87s,semfiltro/ignorados|

Node22 local, Vitest4.1.11. Advertências de tooling existentes (vite-tsconfig-paths detectado e mixedexports da configintegration) foram mantidas, sem editar deps/config para suprimi-las. Silêncio intermediário não contou como sucesso; as mesmas sessões79557/91114/30761 foram acompanhadas até a saída terminal.

O recorte amplo selecionou caminhos rastreados: caminhos-rastreados, paleta, ci-workflow, confirmacoes, identificacao-registro, enums-rotulos, botoes, useEventosInbox.interacao, useEventosInbox, eventos-inbox e SeloNaoLidasInbox. O comando também continha filtro src/lib/nao-lidas-inbox.test.ts inexistente; não se conta como arquivo executado. A loja atual é definida em SeloNaoLidasInbox e coberta por seu teste incluído. Não se declara12arquivos, suíte global ou nova rodadaCI.

## Ambiente e banco

Cliente físico começou485, enquanto a base fonte é487. Antes de TSC/INT, integrador gerou Prisma5.22 correto (ROOT55900/9678df,terminal0) sem migrations e mudou somente o perfil local para integracao. Banco descartável erp_genius_test/ROOT487 reservado exclusivamente; todos os transportes vazios. A execução30761 testou o arquivo inteiro, que trunca somente esse banco de teste conforme configuração autorizada. Banco originalB490 não foi usado/alterado nem submetido a helperE1.

Após30761, banco liberado ao integrador. ROOTf6de8b restaurou perfil dev-gravacoes; cliente físico continua487 para esta fonte. Nenhuma novaINT autorizada ou iniciada. Retomada337 exigirá novo preparo/generate490 coordenado; não há downgrade do bancoB nem edição de perfil pelo DEV.

## Commits e identidade

- d7859ab45b2e22c4c492cdbd16d854c45aa53566: guarda380/LF, SPEC/quadro.
- 6f0e83a4c2346c2d3a3d7023a01a4e2769d4a199: paleta381, docs18/quadro.
- 924b07325774fa53c9b8f0c0ea9a5dc6927498db: remoção396C4 e avaliaçãoC3, INTLC/SPEC/quadro.
- Commit final deste relatório: teste396C5+SPEC/quadro, sem alteração executável após os gates acima.

Package.json, lock, prisma/schema/migrations, scripts/harness, PNGs e runtimehook/eventos/loja são comparados por objetos com4829 no freeze. O único src produtivo alterado é consultas-inbox (cinco linhas órfãs removidas); demais alterações TS são guardas/testes. Sem install/Prisma peloDEV/servidor/browser/envio/push/merge/remoto.

## Limites e handoff

Não é global integrado nem QA independente. ROOT/TESTER coordenam esses gates e publicação. PR395C6/Escape pertence ao DEV A; links390C2, avisos392C9, logs/whitespace e curadoria393C6/395C7 pertencem ao ROOT. Nenhum PNG/log bruto, artefato privado, snapshot ou relatório de auditoria remoto de52KB foi acrescentado neste lote.
