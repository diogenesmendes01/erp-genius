# Inbox #336 — composição sobre o produtor #335

Composição inicial `e9162d83466314b764414d4e048d4c8385236e65`, baseada no head documental da PR #414. Produto selecionado de `a96d86455efedb960b60dac198a99eb82238cbdd`, harness de `953fb6342642d40d6ebdb80443adcc42761c3637` e ajuste responsivo de `65839a85ebf87b4dcb443fef5acebe86538d00f0`. Os documentos curados foram extraídos como conteúdo final; a história intermediária que incluía PNGs não foi incorporada. Publicação somente após #335 em main.

## Correções encontradas na regressão global

A primeira global, `36777/c99706`, saiu 1: 921 arquivos (919 aprovados), 7.230 testes (7.228 aprovados), 219,85 s. Dois achados reais: `col-span-2` sem breakpoint em FichaContato e o driver legado BAILEYS na fixture `atalhos.int`. A correção usa `col-span-full`, que ocupa as linhas de grade já definidas sem criar coluna implícita, e o driver atual MOTOR. Nenhuma guarda, permissão ou expectativa foi relaxada.

O recorte inicial no sandbox `59daa0` terminou antes dos testes por EPERM no rename temporário do Vitest. O recorte no ambiente permitido, `17d60b`, saiu 0: três arquivos completos/22 testes (responsividade, provedores legados e FichaContato), 1,26 s.

## Verificação após as duas correções

- Global ROOT `23071/96a704`: saída 0, **921 arquivos/7.230 testes**, 230,11 s, maxWorkers 2, sem filtro de nome ou skips. A configuração unitária exclui integração.
- TypeScript global `24087/150b95`: saída 0, heap 8192, sem diagnóstico.
- Lint global `12896/83189c`: saída 0, zero erros/40 avisos herdados, teto 40. A primeira execução tinha 41 avisos, incluindo variável não usada de helper ROOT privado; somente a projeção privada foi corrigida antes de repetir o lint, sem aumentar o teto.
- Integração ROOT, perfil descartável `integracao`, client 487, maxWorkers 1: `74964/2a88f0` executou dois arquivos completos/25 testes (atalhos 12 e paineis 13), saída 0, 91,91 s. O filtro adicional digitado `detalhes.int.test.ts` não existe e não conta como arquivo executado. O arquivo real `painel-detalhes.int.test.ts` foi executado separadamente, `87408/f50ead`, saída 0, um arquivo completo/16 testes, 70,65 s. `aria/consultas.int.test.ts`, `42945/b45117`, saída 0, um arquivo completo/10 testes, 33,59 s. São **quatro arquivos distintos/51 testes**, em três comandos, sem filtros de nome ou skips. O conjunto original necessário à #336 é atalhos/Aria/painel-detalhes, três arquivos/38 testes; paineis é verificação adicional, sem duplicação.

As sessões foram acompanhadas até saída terminal 0. O snapshot integracao foi restaurado antes dessa rodada (`20d61b`, 424 hashes) e depois dela (`c3b737`, 424 hashes). A QA independente do delta `8d843` executou três arquivos completos/22 testes (`ab53fe`, saída 0, 1,43 s), confirmou backend/contratos/harness/schema/deps preservados e analisou o CSS real de Tailwind; parecer e hashes no [índice de QA](inbox-336-qa/indice.json).

## Evidência e pendências

O TESTER já revisou o backend original e executou integração independente de três arquivos/38 testes (`9481/edc89b0`). A revisão independente da curadoria final `6ac` executou 48 arquivos/467 testes unitários e inspecionou as 22 PNGs e as 24 entradas do ZIP curado. Parecer original `output/inbox-336-curadoria-6ac-review-tester.md`, SHA-256 físico `715C647118F43679E076A046974769A589328FEE7E6CF036B56EB646BD5CB2F7`.

As 22 imagens formais continuam nominais ao produto `65839` e harness `953fb`. O [ZIP curado](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-336-aceite-65839-953fb-20261024.zip) tem 1.730.536 bytes, SHA-256 `5fbd1fb9df576f0fbcce250155048ae6bc9b949b19c8fc79f32cc107ceaa5285`, asset `672346747`; upload `83743/f50b9c` e roundtrip `9c7a37` com saída 0 e hash idêntico. Release `421321214` mantida privada em rascunho. A curadoria preserva os limites B2B (DTO real, sem tela de participantes antes de #325), protótipo e finais de linha físicos dos módulos.

Caracterização nativa suplementar no produto real `8d843`, `d85b70`, saída 0: Contatos em 320×844 nos dois temas e 1440×900 claro, usando apenas navegação GET após autenticação fictícia. Mobile: documento 320 px, tracks 48/228 px, botão x16–304 com 44 px de altura e grid-column 1/-1; desktop em flex, documento 1440 px. Zero escrita de negócio, todos os browsers fechados. Foram preparados somente dois registros novos (Admin e Pessoa fictícios), retirados no restauro `3cf217`, 424 hashes. A tentativa anterior `39a158` parou na tela de login porque a credencial de A não existe no banco ROOT; não foi uma falha de produto ou prova visual. As três PNGs suplementares têm badge Next, são privadas e ficam fora da allowlist/ZIP formal. O TESTER conferiu manifesto, hashes e os três originais em adendo separado, sem executar novo browser ou reatribuir as 22 PNGs anteriores.

Base main após #414, CI e comentários ainda pendentes. Não representa homologação ou issue concluída.
