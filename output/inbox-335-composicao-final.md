# Inbox #335 — composição final sobre main

A verificação inclui integração **independente do TESTER** na preparação `a4f6`: três arquivos completos/32 testes, sessão `56263/6a6c55`, saída 0, 121,66 s. No SHA final E0, o TESTER executou outro recorte, de 19 arquivos/139 testes, e confirmou os nove paths do produto iguais a `4c76`. A integração não foi repetida em E0; as fontes e os limites de cada execução permanecem separados.

O painel do atendimento oferece links para a matrícula autorizada, com o código como texto e o ID como destino. O Funil abre a Pessoa correta em Contatos, e o encoder compartilhado monta links internos de conversa sem aceitar origem ou query arbitrária. Os destinos revalidam seus próprios escopos; a leitura contextual D13 não concede CRM global.

A base direta é main `6fe0e49ad5cd6c6dc5e929494d62b33a7770cc26`, squash da #413; a issue 324 foi confirmada como CLOSED/completed. Foram selecionados somente produto `4c76`, harness `86f1/6e498` e documentos `88b`: commits finais `f3ae13ff`, `d3d8a9b7`, `8f8ec7e2` e `e0b35f2c`. Não foi incorporada migration, dependência ou história agregada.

A fonte final é `e0b35f2c54d90ad79cfc70ef69d20b688290de29`. A preparação `bf3443f4a922d2290ec18d372a4d2edf3ae69fb1` foi rebaseada após confirmar que o squash da #413 tem árvore integralmente igual ao seu head. A árvore antes e depois é `24187200c15d98ba45c420143effeb0cd256710a`, prova `ac15e7`, saída 0. O rebase mudou apenas a ancestralidade. O único conflito documental anterior preservou os 1.092.666 bytes do quadro e acrescentou exclusivamente os 1.504 bytes do bloco 335.

## Verificação

- Global ROOT na preparação com árvore igual à final: sessão `1276/d02cc7`, saída 0, 916 arquivos/7.205 testes, 201,27 s, Node 22, maxWorkers 2, sem filtro ou skips. A configuração unitária exclui integração.
- TypeScript global `1218/621415`: saída 0, heap 8192. Lint global final `38745/80d965`: saída 0, zero erros/40 avisos herdados, dentro do teto 40 do CI. A primeira execução saiu 0 com 43 avisos; três vinham de dois helpers privados temporários não publicados. Os usos desnecessários foram removidos, e o lint completo foi repetido. Nenhuma guarda ou limite mudou.
- TESTER no SHA exato E0: 19 arquivos/139 testes unitários, `f1dbe4`, saída 0, 3,22 s. A prova estática `aba719` confirmou nove paths do produto iguais a `4c76`, nove do harness iguais a `6e498`, três do fix Tags iguais a `7ff` e três do C5 iguais a `0e4`. Schema e dependências permanecem iguais à base.
- Integração independente do TESTER na preparação `a4f6`: sessão `56263/6a6c55`, saída 0, três arquivos completos/32 testes, 121,66 s, perfil `integracao`, cliente 487, maxWorkers 1, sem filtro ou skips. Arquivos: `paineis.int`, `paineis-envio.int` e `painel-detalhes.int`. O delta posterior em SRC/SCRIPTS contém somente os três paths C5 já revisados/testados na #413, sem mudar o código 335. Não se alega uma nova execução desses 32 testes em E0. O integrador restaurou o banco após as suítes coordenadas, com 424 hashes/snapshot preservados.

A revisão original de `4c76` continua nominal à sua fonte: cinco arquivos/38 testes unitários em duas chamadas e três arquivos/32 integrações, sem somá-los como casos distintos à nova rodada. Os seis pareceres completos, hashes físicos/LF, fontes e execuções estão no [índice QA](inbox-335-qa/indice.json). Uma tentativa administrativa do TESTER usou SHA de 41 caracteres e terminou antes das comparações; o parecer final preserva o negativo `19cd01` e a prova correta posterior.

O CI rápido continua sem `*.int.test.ts`; a política de integração noturna/dispatch não foi alterada. A evidência independente local acima não é uma execução do workflow de integração nem um novo gate em E0.

## Evidência visual

As 64 PNGs positivas originais são 24 formais e 40 complementares, total de 4.273.828 bytes, fontes produto `4c76` e harness `6e498`. A inspeção independente conferiu os 64 hashes e as pranchas de navegação/alcance, além dos originais críticos. A matrícula e Contatos foram abertos por navegação real; o convidado sem papel de matrícula recebeu acesso negado. O protótipo funcional é N/A explícito. Não houve nova captura na composição atual.

O link móvel aparece inteiro em y482,5–499,5 de uma janela de 500 px. Depende de rolagem local/Tab e tem 0,5 px de folga, sem promessa de margem maior. Duas EventSources sequenciais significam máximo de uma simultânea, não uma única construção total. As rodadas negativas e fotos com Preferences do Next estão fora da lista positiva.

O [pacote privado curado](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-335-aceite-4c76-6e498-20261023.zip) tem 4.321.966 bytes, SHA-256 `ed71e143255c6f540ce6e5223c1ccc7b4f416db48a66c572f9b2b7d6eea38a6c`, asset `670649541`. Upload `9435c8` e roundtrip autenticado `f689c7` terminaram com código 0 e hash idêntico. A release `421321214` foi mantida em rascunho. São somente 64 PNGs, manifesto e README curados; sem credenciais, brutos ou PNG/ZIP no Git.

## Limites

Sem schema/dependências, consultas novas por item, alteração de permissão, polling/SSE adicional, envio real, ativação de integração ou deploy. As 11 linhas fictícias do aceite visual foram retiradas no restauro A `c538fc`, com 424 hashes conferidos. A #335 fornece o produtor compartilhado; os atalhos de entrada da #336 já estão implementados e em validação separada. O consumidor de `agendar=1` pertence à E4 e não foi acrescentado nesta PR.

O commit final desta publicação acrescenta apenas QA/documentos. Esta revisão C3 muda prosa, sem alterar os seis pareceres históricos, JSONs, hashes ou allowlists. CI do novo head documental, novos comentários e merge continuam com o integrador. Não marcar a issue como concluída antecipadamente.
