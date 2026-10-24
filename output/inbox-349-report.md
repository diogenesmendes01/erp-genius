# #349 — relatório DEV, cartões e decisões

Estado de publicação: composição598aae2c diretamente em main79310013. Sete SRC são byteiguais ao commit DEV/QA cb285; único conflito no quadro preservou main integral e o bloco349. TESTER aprovou2UNIT/30,2INTcompletos/44 e lint7; ROOT aprovou TSC ORIGINAL3356/EXIT0 sem exclusões e lint GLOBAL18377/EXIT0,zero erros/40avisos herdados. Restauros DEVab76e0 e TESTER927c1d terminaram0,424hashes e sequências preservados. [Parecer integral e limites](inbox-349-qa/indice.json). Negativos amplos DEV preservados; busca herdada é423 separada. CI e publicação finais ainda pendentes, issue349 aberta.

Base exclusiva: 54c44b2ad2f5414f346e07dea76001a13c799051 (#342), branch codex/inbox-e3-349-sugestoes. A entrega não importa #343. O produtor #342, uso.ts, executor, guards globais, schema, SQL e dependências permanecem iguais à base. Conferência estática ccb419/119ed8 verificou 12 paths protegidos e seis funções do histórico (incluindo desfazer/reverter) idênticas. Sem migração nova.

A implementação e seus limites estão na [SPEC](../docs/specs/inbox-sugestoes-thread.md). Paths de produção: sugestoes-thread.ts, historico.ts e consultas-inbox.ts. Quatro paths de teste incluem os dois arquivos INT, o decoder puro e somente cinco literais do fixture PainelAtendimento.aria.test.ts. Esse complemento foi autorizado pelo ROOT; os asserts e o consumidor de produção não mudam.

## TDD e diagnósticos preservados

- RED 743ee1: módulo do decoder ainda ausente, sem casos coletados. GREEN 09713d: arquivo completo, 23/23, saída 0.
- RED INT 98070/0a3394: dois arquivos, 12 falhas, dois passes e 28 casos filtrados (42 total), 54,52 s. Retry e ator revogado durante lock produziram falhas causais; um caso concorrente também apresentou erro administrativo de importação next/server/next-auth, não classificado como RED do produto.
- Edição inválida do histórico rejeitada pelo TSC c0fa13 e INT 46251/b6f011: erro de delimitação LF/CRLF no patch. O arquivo foi reconstruído do blob base; esse comando agregado continua EXIT1, embora a consulta completa tenha passado 11/11.
- Histórico 67810/46bfb1: 30/31 completos, 148,91 s, EXIT1 exclusivamente pelo import administrativo concorrente. A tentativa de carregar auth antecipadamente não resolveu. Não reclassificar esse run.
- O padrão já existente em comercial/criar-lead-idempotencia.int.test.ts documenta que imports concorrentes de auth escapam do mock no Vitest. O setup adapta somente exigirSessao e conserva carregarUsuarioFresco real do banco, a defesa de portal, o checkpoint real pós-lock, autorização, transações e executor. Não altera guards globais nem mocka a decisão.
- GREEN causal 68176/1686c1: três selecionados, 41 filtrados, 44 total, 18,15 s, saída 0. Aprovação concorrente gera uma intenção/Evento; motivo null/500 preserva igualdade; pool1 lê ação e nome ainda não commitados e preserva rollback. Esse recorte não substitui os arquivos completos.

## Gates do freeze

Recorte UNIT 57270/29f241: 23 arquivos completos, 185 casos, 13,82 s, saída 0; comando local vitest run src/server/aria e PainelAtendimento.aria.test.ts, maxWorkers2. TSC auxiliar 60404/445230 saiu 0. A conferência final 20369/11d539, incluindo os diagnósticos privados posteriores, também saiu 0, com todos os SRC/testes atuais incluídos. A configuração privada estende a original e exclui, além de node_modules, SOMENTE output/inbox-326-a2-diagnostico-private.test.ts e output/inbox-326-package-r8-7a30d4-preservado-private/inbox-326-a2-diagnostico-private.test.ts. São privados históricos incompatíveis com essa base, sem alteração ou remoção; o TSC original negativo 27111/d08ff2 permanece nominal à investigação anterior. O checkout limpo deve ser verificado pelo integrador.

Lint dos sete paths no freeze final c14654 saiu 0. O anterior 2ab17d continua nominal à versão antes do ajuste de nome/testes. Lint global eslint . ad78b6 saiu 2: configuração ativa de react/no-unescaped-entities sem plugin react ao enumerar este worktree. A inspeção d1a977 localizou a configuração inválida no privado histórico output/inbox-325-validar-curadoria-private.cjs; a configuração calculada para os SRC .ts e para .mjs contém o plugin. Sem mudança da configuração, ignore ou dependências para encobrir o negativo. O resultado não é atribuído à lógica #349 nem declarado verde global.

UNIT global 7912/c0b65c: 938 arquivos/7.448 casos, 341,97 s, saída 0, sem filtros ou testes ignorados. Integração ampla 45910/3f0f03 terminou EXIT1: 23 arquivos completos (21 aprovados, dois com falha), 280/282 casos, 1.304,31 s, sem filtros/skips. Os arquivos de histórico (32 casos) e consulta (12 casos) passaram dentro desse agregado negativo; o comando próprio final 14972/7d245d passou os dois arquivos completos e seus 44 casos, 183,25 s, saída 0, sem filtros/skips. Banco ciint 491 exclusivo, cliente próprio 490, perfil ci-integracao; nenhum provider real. Após 14972 e a última observação READ ONLY c7d32e, o banco foi liberado ao ROOT. Não há executor DB ativo; restauro do snapshot 491 permanece responsabilidade do integrador.

## Pendências e limites

QA independente, composição, CI e publicação da #349 continuam sob ROOT. A #342 já foi integrada pelo integrador. Não há UI nova; o cartão visual pertence à #350. Nenhuma mensagem real, integração externa, preview ou ação manual foi executada. A entrega DEV não conclui a issue e não autoriza publicação antes da dependência.

## Identidade da fonte verificada

SHA256 do conteúdo Git normalizado em LF; não confundir com bytes físicos CRLF de alguns fixtures.

| Path | SHA256 GitLF |
| --- | --- |
| src/server/aria/sugestoes-thread.ts | b6affb2e4a8d960c6e53cd395b41549432142beb11fed1b28501182d25d86a41 |
| src/server/aria/sugestoes-thread.test.ts | 084633f5f24ef8f5bd9c19c2e983cfed560766dab30f916c2f2b2b0ac8ebcaea |
| src/server/aria/historico.ts | 0bbd1784bbbd733c3d5019e716a613407024dc499da2e42a65fb6b92e3b4cca8 |
| src/server/aria/historico.int.test.ts | 6b4a260ac6d9fab60f7b85eab854c75a06d0a1a1d79bc8f99868dfd858fafd55 |
| src/server/whatsapp/consultas-inbox.ts | 7571d8b3b90d297eebb95fcf16671ff4b129f398be37b4a087fa64bcef95b8cf |
| src/server/whatsapp/consultas-inbox.aria.int.test.ts | ba3c047b5ee73fb06a76a6e4b7aa2b1a67412cacd74b3baf3cd253aabec7e63d |
| src/app/(app)/inbox/PainelAtendimento.aria.test.ts | ffdb6d3883d56ee38fd46b49255cb1de6a5762bbef9a8bea016fb1b3f1cd44de |

## Negativos temporais amplos, separados da #349

Em orquestrador.int.test.ts, orcamento_so_sugerir esperava SUGERIU e recebeu RESPONDEU. Em conhecimento/busca.int.test.ts, ignora_fonte_vencida recebeu também a fonte vencida na asserção final. Esses dois arquivos e seus produtores não foram alterados. O ROOT confirmou a integração remota da base #342 verde (quatro shards, 350 arquivos/3.104 casos e quatro preparadores opt-in ignorados); isso não reclassifica a execução local.

Diagnóstico READ ONLY a26e33 saiu 0: sessão America/Sao_Paulo, ChamadaIA.criadoEm timestamp sem fuso, NOW() convertido para timestamp local 19:43 e UTC 22:43; relógio do servidor 14 ms além do fim do intervalo Node medido. A busca compara validoAte semTZ com now() timestamptz, fronteira incompatível com UTC implícito sob esse offset. Nenhuma correção de busca entra na #349. Orçamento permanece sem causa conclusiva: cópia privada instrumentada com agora explícito e leitura real prévia passou em 40295/d1cb32 (um selecionado/34 filtrados, 15,55 s), sem reproduzir o negativo integral. A observação não equivale ao teste original nem prova que os 14 ms expliquem o resultado.

Por coordenação ROOT, investigação/correção temporal herdada terá escopo separado, depois da reprodução e comparação de base; não se altera orçamento, busca, fuso, configuração global ou cobertura para tornar a #349 verde. A dependência #342 foi integrada pelo ROOT em 79310013; esta entrega ainda aguarda QA/CI/composição próprios.

## Fronteira temporal confirmada e encerramento DEV

A segunda observação READ ONLY c7d32e saiu 0: FonteConhecimento.validoAte é timestamp sem fuso e ChamadaIA.criadoEm tem default CURRENT_TIMESTAMP. Um ISO vencido há um segundo resultou true ao comparar timestamp(3) > now() na sessão America/Sao_Paulo e false ao comparar com now() AT TIME ZONE UTC. Isso confirma a coerção da busca sem alterar seu produtor. O resultado de orçamento continua inconclusivo e não é explicado por essa prova. Correções temporais ficam fora do commit #349, conforme coordenação ROOT.

Resumo de gates próprios: UNIT 23 arquivos/185 casos e global 938/7.448, INT 2/44 em comando próprio, TSC auxiliar e lint dos sete paths, todos com saída 0. A integração ampla continua nominalmente negativa (280/282) e o lint global continua com erro de configuração no privado .cjs. Essas ressalvas não são apagadas nem convertidas em aprovação global. Banco liberado para restauro 491; QA independente, composição, CI e publicação próprios continuam pendentes.

## Restauro ROOT e hipótese para investigação separada

Após o commit funcional c0e7edca, o ROOT confirmou restauro ab76e0 com saída 0: ciint491, 424 hashes, 502 registros e sequências do snapshot preservados. A lease está livre. Não houve nova operação DB do DEV depois da liberação.

O integrador propôs investigar se criadoEm, retornado pelo MESMO create, fica à frente do instante Node capturado imediatamente depois do await e antes de processarTurnoAria. Nesse caso o filtro criadoEm <= agora excluiria a chamada intencionalmente; uma fixture com criadoEm explícito no passado seria candidata de correção separada, sem relaxar orçamento. Ainda não há essa prova nem autorização para executar o próximo diagnóstico. Precisão do controle já feito: agoraObservado foi capturado antes da leitura adicional e passado como deps.agora, portanto a leitura não avançou o cutoff daquele controle. O skew de 14 ms permanece hipótese, sem causalidade afirmada.


## Correção isolada das expectativas dos painéis — 24/10/2026

Branch codex/inbox-ci-349-defaults, base b292bf791e2a4762f892a68bba87a9de5f407b5f. A branch da #351 permanece preservada. O [shard 4 da Integração 40140932662](https://github.com/diogenesmendes01/erp-genius/actions/runs/40140932662/job/121012339272) terminou com 733 passes e duas falhas em 735 casos, 88 arquivos. Os erros em paineis.int.test.ts, linhas 82 e 107, mostram apenas cartoes: [] e podeDecidir: false adicionais ao objeto aria esperado. Esse run continua negativo; não é falha de orçamento nem é reclassificado pelo teste local. Outros shards e gates da publicação continuam sob ROOT.

Raiz: carregarPainel incorpora o DTO de carregarAriaDoAtendimento, ampliado pela #349. capacidadesAria reserva decidirHistorico a Administrador/Gerente Comercial; Secretaria, Professor e vendedor convidado recebem naturalmente false e []. Há quatro expectativas antigas (82, 88, 107 e 112): as primeiras falhas interrompiam os dois testes antes das expectativas dos convidados. O fix acrescenta exclusivamente esses dois defaults aos quatro literais. Todos os nove toEqual do arquivo permanecem; substituir os quatro novos literais pelos antigos reproduz byte a byte o blob base em LF. Nenhum produtor, permissão, schema, dependência ou handoff da #351 mudou.

TDD local no ciint491 exclusivo, cliente próprio 490, perfil ci-integracao, snapshot de 502 registros/424 hashes restaurado pelo ROOT em 362469: RED sessão 86203/c0d741, EXIT1, arquivo completo de 13 casos, 11 passes/duas falhas, 55,79 s; reproduziu os dois erros remotos. Depois do terminal, o patch foi aplicado. GREEN sessão 87482/a575d7, EXIT0, mesmo arquivo completo, 13/13, 58,07 s. Comando em ambas: Node22 node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/inbox/paineis.int.test.ts --maxWorkers=1. Sem filtro por nome ou teste ignorado. Não foram repetidos os 23 arquivos amplos nem UNIT global.

Lint dirigido do único path, 4caa73, EXIT0 sem aviso. TypeScript não foi repetido pelo DEV para o delta exclusivo de literais, conforme autorização ROOT; verificação final fica com o integrador, sem declarar novo TSC aprovado. SHA256 GitLF final do teste: 01858be4581e73b0cd670bb7be59b94214d3e0f9fe855a0cbfa659a3b595a04e, 22.121 bytes. Logs completos RED/GREEN e prova de identidade permanecem privados, fora do commit.

Banco explicitamente liberado ao ROOT após o terminal GREEN, sem nova operação DEV; restauro é responsabilidade do integrador. Entrega separada em um arquivo de teste e adendos de SPEC/relatório/quadro. Não altera os negativos temporais anteriores ou presume aceite da integração completa remota.


Restauro posterior confirmado pelo ROOT em cf2a26, EXIT0: ciint491, 424 hashes, snapshot e fixture preservados, zero atividades. Nenhuma nova operação DB pelo DEV. A fonte funcional permanece igual à base b292bf79; este complemento contém somente expectativas e documentação.
