# Transferência no Inbox: composição da entrega #360

A composição reúne a PR #446 (`19a4672b`) e a candidata DEV `3b4cf1b5`, com a interface unificada de transferência e as regras atuais. Contexto setorial opcional e acesso do novo responsável sem alterar a carteira continuam nas #369/#370; esta entrega não encerra D5.

Os 31 arquivos de código do delta integrado foram conferidos. O backend e os demais arquivos permanecem literais à candidata DEV. No cabeçalho, somente o callback de ref foi acrescentado às classes já validadas em `7e798e6b`. O conflito no mock continha os mesmos quatro exports de ícones, já corrigidos: ficou a versão ROOT, sem duplicação ou importação ampla. O quadro conserva as entradas de ambos os pais. Não há mudança de schema, perfil, cliente, package/lockfile ou configurações.

Validação na árvore integrada `8dad60c03858855f96f8c010e15eff0ceb0aef24`: sessão 4711, terminal c8014e, EXIT0, 28 arquivos completos e 501 testes. UTC, um worker, heap 2048 MiB, configuração original, sem filtros ou skips; árvore e configurações preservadas até o terminal. Esse recorte inclui os 25 arquivos independentes do TESTER e as verificações responsivas da faixa; não é suíte global.

QA anterior com fontes identificadas:

- TESTER no commit exato `3b4cf1b5`: 25 arquivos/467 testes e oráculo de oito casos original, EXIT0. Parecer `f16577adf1c253b88fc0638cf586caf06239f66885548d93e349cbe6c12a4bbe`.
- Backend em `78fb1f18`: 14 casos nativos e regressão de quatro arquivos/41 casos, EXIT0, DEV e TESTER. A filha R2 altera apenas três linhas de composição da interface, com backend literal; não houve nova execução SQL atribuída à filha.
- A guarda de formulários foi preservada. A contraprova mostrou formulários irmãos com portal; a correção tornou explícita a função de renderização. O negativo anterior e o OOM inicial de 1 GiB permanecem nas fontes originais; a repetição independente com 2 GiB concluiu todos os casos.

O TypeScript original sobre `fce34926` encontrou TS2322: a prop pública opcional `destinos` chegava sem normalização ao novo controlador. O teste de consumidor abriu o formulário real e reproduziu `undefined.filter` (terminal 1fe07a, um caso falhou e dois passaram). A correção mantém o contrato opcional e aplica `destinos = []` na entrada do coordenador. O mesmo arquivo completo passou: terminal 493590, EXIT0, três casos, UTC, um worker, heap 1024 MiB. O portal geométrico é substituído; coordenador, controlador e formulário são reais. O primeiro replay ficou bloqueado por EPERM no cache temporário; o primeiro GREEN expôs uso incorreto de `document.querySelector` no DOM mínimo, corrigido para `host.querySelector`. Esses negativos não contam como aprovação.

O replay TypeScript `84950/f6b04c` sobre `88aa57d7` eliminou o erro de produção e identificou um erro na fixture nova: `Papel.ADMIN` não existe. A fixture usa agora `Papel.ADMINISTRADOR`; o arquivo completo voltou a passar três casos (3d9559, EXIT0), sem outra mudança de produção. O parecer independente de `88aa57d7` foi favorável ao delta de produção (`398df0f6350ec535ea44bdec10c8ea9e346b5d587a2bdbd671b74649b1cefadf`); seu teste anterior precisa ser qualificado pela correção posterior do enum.

Gates originais concluídos sobre a fonte congelada `c3ba607f0c9b608e47abf8d88edfa68c8711acbb`, com configurações preservadas:

- TypeScript: sessão 53106, terminal 4abf1e, EXIT0, `tsc --noEmit --incremental false`.
- Unitários globais: sessão 52057, terminal 3be700, EXIT0, 1.019 arquivos e 8.801 testes, UTC, dois workers, heap 2048 MiB. Nenhum filtro ou skip adicional; exclusões originais preservadas. Integrações SQL são evidências separadas.
- ESLint: sessão 25049, terminal 7c6cdc, EXIT0, zero erros e 63 avisos, heap habitual 2048 MiB. Os dois replays anteriores encerraram com OOM (36768/c5da1a e 86178/3b26f1): o comando estava analisando os backups não rastreados do cliente Prisma, cada um com `index.d.ts` de 99.629.505 bytes. As cópias físicas foram movidas para a pasta externa de evidências, com os 21 arquivos de cada cópia conferidos por hash, sem tocar os clientes ativos nem as regras/configuração do lint. O comando original passou após essa correção do ambiente.
- Build: sessão 63477, terminal 8d5b15, EXIT0, incluindo TypeScript e 115 páginas estáticas. Build ID `Z9-O-_AbBHxCBkn16uRV2`. Usou somente o perfil ROOT descartável; sete provedores externos vazios, sem servidores ou workers externos.

TESTER na fixture corrigida `c3ba607f`: três casos completos, terminal 2a569b EXIT0; complemento independente `033fbb0579acd9e5746f0e5ce5c78da426672c84e06a82db284aa2b1ce622f89`. O backend permaneceu literal ao DEV; a normalização de destinos é a correção localizada do consumidor.

Pendentes: aceite visual específico do popover/folha de transferência, CI e revisão da publicação. As imagens anteriores do cabeçalho não homologam o fluxo novo. A base #358 também tem a correção C1 de conteúdo especial em investigação própria; esse caminho não é alterado pela #360. Nenhuma mensagem real, provedor externo, deploy, merge em main ou fechamento de issue nesta etapa.
