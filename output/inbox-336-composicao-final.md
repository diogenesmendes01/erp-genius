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

As sessões foram acompanhadas até saída terminal 0. O snapshot integracao foi restaurado antes dessa rodada (`20d61b`, 424 hashes); novo restauro após a rodada ainda deve ser confirmado.

## Evidência e pendências

O TESTER já revisou o backend original e executou integração independente de três arquivos/38 testes (`9481/edc89b0`). A revisão independente da curadoria final `6ac` executou 48 arquivos/467 testes unitários e inspecionou as 22 PNGs e as 24 entradas do ZIP curado. Parecer original `output/inbox-336-curadoria-6ac-review-tester.md`, SHA-256 físico `715C647118F43679E076A046974769A589328FEE7E6CF036B56EB646BD5CB2F7`.

As imagens continuam nominais ao produto `65839` e harness `953fb`; nenhuma captura nova é atribuída às duas correções atuais. A curadoria preserva os limites B2B (DTO real, sem tela de participantes antes de #325), protótipo e finais de linha físicos dos módulos. Revisão exata das duas correções, caracterização responsiva final, publicação do pacote, base main após #414, CI e comentários ainda pendentes. Não representa homologação ou issue concluída.
