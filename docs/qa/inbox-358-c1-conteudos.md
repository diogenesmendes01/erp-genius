# Conteúdo especial durante condução Aria — revisão #446 C1

A API de conteúdo especial criava intenção HUMANO durante `ia`, `aprovacao` ou `handoff`, embora o compositor estivesse bloqueado. O TESTER reproduziu a falha na fonte `c3ba607f`: oito casos, três falhas e cinco controles aprovados; nos três estados o envio de enquete retornava sucesso simulado e criava intenção. Nenhuma mensagem real saiu. Parecer independente `3e9e4920db045d2e260b4feba0215358a5f0114c021c36594220ee17bbf4068a`.

O integrador isolou a correção sobre a publicação `19a4672b`. EnviarConteudoInbox agora chama o mesmo núcleo transacional de texto e mídia. O núcleo conserva os dados JSON, tipo, resumo e mídia; verifica canal/sessão/MIME/posse somente no ramo especial, além das guardas comuns atuais. A action despacha depois do commit. Não há novo lock de ação/configuração depois do atendimento, advisory ou alteração do dispatcher.

Uma contraprova adicional mostrou que o ator podia virar exclusivamente ALUNO enquanto aguardava o atendimento e manter acesso por convite. O núcleo reaplica agora apenasPortal sobre a row fresca da própria TX, com a mensagem canônica do serviço de sessão; não amplia a lista de papéis nem usa sessão memoizada.

## Execuções do integrador

- RED completo: sessão 80129, terminal 51e5f4, EXIT1, 15 falhas e 11 controles aprovados em 26 casos. A matriz cobre três estados × cinco conteúdos, cinco permissões após Assumir real e seis recusas históricas.
- GREEN da matriz inicial: 89087/16a5f1, EXIT0, 26/26.
- Matriz ampliada: 92558/efb353, EXIT1, 33 aprovados e três falhas. Uma era produtiva (papel portal); duas vieram da fixture: driver inexistente MOCK e uma action não drenada após essa falha, que concorreu com o TRUNCATE do caso seguinte e causou 40P01. O negativo foi preservado; não é apresentado como prova de impasse do kernel. A fixture usa agora BAILEYS e aguarda holder e action mesmo em erro.
- GREEN final: 15973/e65ef7, EXIT0, arquivo completo com 36 casos, 156,54 s. Inclui oito mudanças durante espera real comprovada por pg_blocking_pids e duas execuções pool1, sem conexão global dentro da TX.
- Regressão histórica: 62600/20dd21, EXIT0, três arquivos completos/48 casos, 201,56 s: trava-aria.int.test.ts, motor/acoes-mensagem.int.test.ts e motor/conteudo.int.test.ts.
- Unitários pertinentes: 610a94, EXIT0, três arquivos/18 casos completos, UTC/um worker/heap1024. Um replay anterior também passou no fuso local (30d859), separado da evidência UTC.
- Lint focal dos três arquivos de código/teste: af5dd1, EXIT0, zero avisos.
- TypeScript original sobre o commit congelado 708edde7: sessão 63009, terminal a4dab6, EXIT0, sem alteração de fonte ou configuração.

Os testes nativos usaram vitest.integration.config.ts original, perfil ROOT dev-gravacoes, UTC, um worker, heap1024 e arquivos sequenciais, sem filtro de caso ou skip. No arquivo novo, sete provedores ficam vazios e todos os drivers são falsos; nenhum driver é acionado. A regressão histórica conteudo.int.test.ts ativa WHATSAPP_LIVE apenas dentro de fixtures com driver falso para provar o despacho; isso não é envio real e não é descrito como sete variáveis sempre vazias durante todo esse arquivo.

## Pendências

Revisão independente no commit exato corrigido, gates globais da nova composição e atualização da publicação. O aceite visual específico da #358 continua pendente. O parecer RO anterior `5f569643eb35e18fe01d07f6ae64131831acbf8bbcad1c24242e697f0b9fb4c7` validou a estrutura e identificou a barreira de portal antes da correção final; não substitui a QA exata posterior. Nenhum merge, fechamento de issue ou deploy é presumido.
