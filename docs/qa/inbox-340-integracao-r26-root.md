# Integração da issue #340 — documento LATAM e nascimento

Aplicado somente o delta de 42 arquivos `db441f0c` → `2e41ac2a`, sobre o pai ROOT `f591d93a`. Os ancestrais privados do DEV e a implementação parcial da #338 não foram incorporados. O schema conserva a presença do Inbox e adiciona somente quatro campos opcionais em Pessoa, sua relação com TipoDocumento e o índice da migração `20261025205000_inbox_pessoa_documento_nascimento`.

Os dois conflitos previstos foram resolvidos: o painel conserva `carregarContadorAtividadeAria` de `historico-aria-leitura`, com os novos blocos cadastrais separados; o quadro conserva o histórico ROOT e recebe somente as seções da #340. A autorização dos dados antigos para convidados comerciais permanece. Documento e nascimento continuam sujeitos à autorização de contatos e escopo.

Validação ROOT da árvore `0c844f0d6c3106f335c38f67df58483e061c5e16`:

- Unidade e DOM: 15 arquivos completos, 171 testes aprovados, sessão 19417 / terminal c1264c, código 0; UTC, um worker, heap 1024 MiB, provedores externos vazios, sem filtro ou novos testes ignorados.
- ESLint: os 37 arquivos TypeScript do delta, terminal d870b3, código 0, sem diagnósticos.
- Prisma validate: b6c919, código 0. A primeira geração terminou com `write UNKNOWN` sem mudar o cliente anterior; a repetição diagnóstica terminou em b933a9, código 0. Esse erro anterior permanece registrado, sem causa presumida. Nenhuma dependência foi instalada ou alterada.
- Migração no perfil descartável dev-gravacoes: c3259c, código 0. Dados anteriores nas 425 tabelas de negócio, projeção anterior de Pessoa, 495 registros de migração, funções, gatilhos e índices foram preservados. Os quatro campos começaram nulos; nenhuma informação de Aluno foi copiada. Agora existem 496 migrações aplicadas e 426 tabelas.
- Snapshot novo ROOT499: 89e852, código 0, 426 tabelas e 1.383 linhas incluindo histórico. O restaurador ROOT496 foi substituído pelo ROOT499. Outros bancos não foram alterados por esta migração.

As evidências do DEV continuam atribuídas às suas fontes: sete arquivos nativos novos, 33 casos distintos, e seis regressões, 73 casos. O relatório original explica as correções de fixture e instrumentação, o grafo observado, os canários de log e os limites das barreiras. Essas execuções não são testes ROOT nem aceite independente.

Pendentes neste checkpoint: revisão e testes independentes do candidato exato, TypeScript, unidade global, lint global, build, CI e aceite visual com anexos. DOM e dispatcher de cache instrumentado não equivalem a navegador/RSC. A issue continua parcial, sem homologação, deploy ou mensagem externa.

## Manifesto de campos — correção após o gate global

A primeira suíte unitária global da fonte b90e3f23 terminou em 119333, sessão94065, código1: 1.077 arquivos, 9.571 testes aprovados e uma falha entre9.572. O guard exato de campos identificou quatro campos novos em cada um dos dois formulários que ainda faltavam no manifesto. O negativo foi preservado.

A correção acrescenta somente essas oito strings a src/app/campos-mapa.ts, na ordem real dos controles. O teste continua comparando o mapa inteiro, incluindo rótulo, controle e obrigatoriedade. Nenhum teste foi excluído nem teve a asserção relaxada. Esse manifesto é importado somente pelo teste de campos; os componentes produtivos não foram alterados. O arquivo completo campos.test.ts passou28/28 em e1ff32, código0; lint do manifesto também terminou0.

A QA independente do TESTER b90e3f23 passou sete arquivos nativos novos33/33 e seis regressões73/73, todos completos, seguidos de15UNIT171/171. Seu parecer preserva fonte e limites; ele não é navegador nem nova execução do guard de manifesto. O banco TESTER499 foi restaurado, com426hashes e47fixtures conferidos. TypeScript original b90e3f23 também terminou0 em703d99. Os gates da nova fonte após esta correção ainda serão executados e atribuídos separadamente.
