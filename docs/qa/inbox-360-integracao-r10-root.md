# Transferência no Inbox: composição da entrega #360

A composição reúne a PR #446 (`19a4672b`) e a candidata DEV `3b4cf1b5`, com a interface unificada de transferência e as regras atuais. Contexto setorial opcional e acesso do novo responsável sem alterar a carteira continuam nas #369/#370; esta entrega não encerra D5.

Os 31 arquivos de código do delta integrado foram conferidos. O backend e os demais arquivos permanecem literais à candidata DEV. No cabeçalho, somente o callback de ref foi acrescentado às classes já validadas em `7e798e6b`. O conflito no mock continha os mesmos quatro exports de ícones, já corrigidos: ficou a versão ROOT, sem duplicação ou importação ampla. O quadro conserva as entradas de ambos os pais. Não há mudança de schema, perfil, cliente, package/lockfile ou configurações.

Validação na árvore integrada `8dad60c03858855f96f8c010e15eff0ceb0aef24`: sessão 4711, terminal c8014e, EXIT0, 28 arquivos completos e 501 testes. UTC, um worker, heap 2048 MiB, configuração original, sem filtros ou skips; árvore e configurações preservadas até o terminal. Esse recorte inclui os 25 arquivos independentes do TESTER e as verificações responsivas da faixa; não é suíte global.

QA anterior com fontes identificadas:

- TESTER no commit exato `3b4cf1b5`: 25 arquivos/467 testes e oráculo de oito casos original, EXIT0. Parecer `f16577adf1c253b88fc0638cf586caf06239f66885548d93e349cbe6c12a4bbe`.
- Backend em `78fb1f18`: 14 casos nativos e regressão de quatro arquivos/41 casos, EXIT0, DEV e TESTER. A filha R2 altera apenas três linhas de composição da interface, com backend literal; não houve nova execução SQL atribuída à filha.
- A guarda de formulários foi preservada. A contraprova mostrou formulários irmãos com portal; a correção tornou explícita a função de renderização. O negativo anterior e o OOM inicial de 1 GiB permanecem nas fontes originais; a repetição independente com 2 GiB concluiu todos os casos.

O TypeScript original sobre `fce34926` encontrou TS2322: a prop pública opcional `destinos` chegava sem normalização ao novo controlador. O teste de consumidor abriu o formulário real e reproduziu `undefined.filter` (terminal 1fe07a, um caso falhou e dois passaram). A correção mantém o contrato opcional e aplica `destinos = []` na entrada do coordenador. O mesmo arquivo completo passou: terminal 493590, EXIT0, três casos, UTC, um worker, heap 1024 MiB. O portal geométrico é substituído; coordenador, controlador e formulário são reais. O primeiro replay ficou bloqueado por EPERM no cache temporário; o primeiro GREEN expôs uso incorreto de `document.querySelector` no DOM mínimo, corrigido para `host.querySelector`. Esses negativos não contam como aprovação.

Pendentes: nova execução de TypeScript, suíte global, lint e build da composição corrigida; aceite visual específico do popover/folha de transferência, CI e revisão da publicação. As imagens anteriores do cabeçalho não homologam o fluxo novo. Nenhuma mensagem real, provedor externo, deploy, merge em main ou fechamento de issue nesta etapa.
