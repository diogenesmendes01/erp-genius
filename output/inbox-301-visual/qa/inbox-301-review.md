# #301 — revisão de código e visual TESTER

**Parecer de código favorável** no SHA exato `4803b06100b6907968304ffddc11cd7da9fbeab4`, base publicada #300 `30706754`; `git diff --check` exit 0. O escopo está nos 12 arquivos declarados (fonte, histórico, composição/renderização, testes, SPEC e quadro); não altera `InboxNovo`, servidor, schema, permissão ou transporte.

## Contrato percorrido

- `fonteErp` repassa notas da rota; `[]` permanece array e `null`/ausência sinaliza nenhuma alteração. `HistoricoConversa.abrir` limpa a conversa anterior e publica notas da carga inicial; `recarregar` e `maisNovas` substituem por qualquer array, inclusive `[]`. `maisAntigas` conserva as notas da janela, e geração/abortamento impedem resposta antiga de vazar após a troca de atendimento.
- `reagirAoAviso` já percorre `maisNovas` para `atendimento.atualizado`. A publicação da página `depois` ocorre antes do teste de ausência de mensagens, então uma nota nova chega mesmo quando `p.mensagens=[]`; quando não há cursor de mensagens, a abertura busca a coleção atual. A nota arquivada desaparece ao receber `[]`/coleção atualizada.
- `itensDaThread` intercala notas/mensagens por horário, desempata pelo id dentro do mesmo tipo e põe mensagem antes de nota no mesmo instante; `nota:<id>` evita colisão de chave. Enquanto `temMaisAntes`, omite notas anteriores ao primeiro horário carregado; com início atingido ou thread só com notas, exibe todas. Notas não entram nos cursores nem no limite de 600 mensagens.
- `NotaNaThread` distingue atendimento/oportunidade e sinaliza conteúdo só da equipe; mostra autor ou ausência, preserva quebras, escapa HTML via React e usa o fuso de exibição para a hora. `ConversaAberta` envia notas apenas a esse cartão, sem comandos de mensagem/contato.

## Verificação independente

Recorte unitário Node **22.23.2**, sem banco: `historico-conversa.test.ts`, `itens-thread.test.ts`, `NotaNaThread.test.ts`, `ConversaAberta.test.ts` e `InboxNovo.interacao.test.ts`: **5 arquivos/68 testes, exit 0**, sem filtro de nome ou ignorados. O DEV relata recorte ampliado de 29 arquivos/320 testes exit 0 e ESLint dirigido sem avisos; gates globais e captura de duas sessões ainda serão coordenados pelo integrador. Não chamo o recorte TESTER de suíte completa.

## Aceite visual independente

Fonte rebased `33d0a99174bc2d00601ad91b08037bc3eac4a74b` (arquivos de produção iguais ao SHA de código revisto), Node 22.23.2, banco descartável `tester`, servidor local `3109` do integrador e transportes externos desabilitados. Duas sessões Admin fictícias, isoladas em browser contexts, abriram o mesmo atendimento. A fixture continha nota interna prévia. Nos três tamanhos contratuais (1440×900, 1024×768 e 390×844), em claro e escuro, o autor registrou uma nova nota interna e a colega a recebeu pelo aviso sem reload em todos os seis contextos. As contagens de notas avançaram juntas em uma unidade; `performance.timeOrigin` e eventos `load` não mudaram; `pageerrors=[]`. A contagem **real no banco** de `MensagemWhatsApp` da conversa ficou 3→3 em cada contexto. O cartão mostra rótulo de equipe, autor e horário com `datetime`; inspecionei PNGs desktop claro e celular escuro.

Manifesto: `output/inbox-capturas/notas-thread-depois/manifesto.json`, seis contextos/24 PNGs, **exit 0** na sessão 80898. A primeira execução do capturador (sessão 2200, exit 1) mediu a colega antes de a carga inicial GET terminar: `count()` deu zero enquanto uma leitura DOM imediatamente posterior já via três notas. A espera explícita pela nota seed nas duas sessões e o snapshot atômico corrigiram a corrida do harness; a repetição ficou sem falhas. A primeira tentativa deixou seis notas fictícias adicionais no banco descartável, portanto a segunda começou com 7 notas e terminou com 13; isso explica as contagens progressivas do manifesto. Não houve mensagens externas.

**Limite:** a captura confirma nota inicial, recepção em duas sessões, rótulo/autor/hora, preservação das mensagens e ausência de reload. Arquivamento de nota, troca de atendimento e ordenação em janelas paginadas foram cobertos por revisão/testes de código, sem roteiro visual separado. O full suite e a publicação permanecem sob coordenação do integrador.
