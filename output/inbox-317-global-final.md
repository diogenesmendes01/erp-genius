# #317 — composição final verificada e evidências para PR

Registro atual, 23/10/2026: fonte integrada 85fdfb849007488b87204b9d1ded70ac406cbc28,
com produto a86, harness bf4/aa570, busca C2 7a e transporte C6 01a. Não contém
#319. Head9005 acrescenta apenas metadados do DEV; produção permanece igual85f.

- Global integrado sem filtro de nome ou skips adicionais, maxWorkers2:
  sessão56369 terminal exit0,897 arquivos/7.021 testes,270,09s. Log privado
  output/inbox-317-85f-global-unit.log. Global anterior317bbb, sessão57940,
  também terminal exit0:897/7.013,272,97s; não substitui o gate pós-C6.
- Next typegen seguido de TSC --noEmit --pretty false, heap8192:
  sessão38143 terminal exit0. ESLint global49666 terminal exit0,0erros/42avisos:
  40 avisos herdados em fontes e2 em staging318 privado. Nenhum detector ou
  limite alterado. CI em checkout rastreado continua sendo gate separado.
- Formal corrigida4941 terminal exit0:24/24PNG app×protótipo, humano+nota,
  1440×900/1024×768/390×844, dois temas. Todas inspecionadas. A rodada16261
  inteira, incluindo parciais positivos, fica fora da allowlist final.
- DEV normal29367 (8contextos/24PNG), permissões89958 (6contextos/12PNG) e
  C2 ERP88684 (2contextos/10PNG), todos terminal exit0. C2:165itens, busca/pin
  000 e149, notificações PG reais emitidas apenas pelo integrador; GET4→5 e5→6,
  top631/575, mesma área/âncora e foco durante SSE, zero falhas/React/externos.
  Browsers fechados, preview53617 parado e snapshot A restaurado01c7be,
  424tabelas/hashes conferidos,551linhas originais. Sem mensagens externas.
- TESTER independente: produtoa86 13/239, extensão df9 5/66, seletor offline
  Chrome2/2 +Vitest5/44, normal ERP8contextos/24PNG e C2 ERP2contextos/10PNG,
  todos saída0, com pareceres próprios versionados. C6 isolado01a:6/47próprios,
  favorável; ROOT conferiu fonte/teste SSE byte-idênticos ao isolado cb4963.

Allowlist DEV explícita:70originais+18pranchas/88PNG, com hashes e fonte por
grupo; TESTER34PNG. O pacote seleciona apenas esses122PNG positivos e metadados
sanitizados. Visuais em317bbb/df9 antecedem C6; produção visual equivalente,
mas não atribuir recuperação CLOSED/C6 às capturas do ERP. Prova HTTP real do
autor de C6 é helper isolado, com artefato próprio, não E2E do ERP. Variante
travada permanece desligada na E1; alvos44px e editor visível, sem prometer
largura ampla em320. Nota e edição não foram enviadas a integrações externas.

Publicação do PR, CI, revisão e merge continuam etapas separadas. Dependências
#308/#315 e a cadeia até#316 devem ser integradas antes da homologação final.
O porte C6 é compartilhado da #396 e deve entrar pela atualização das bases;
nenhum PR publicado de outra frente foi alterado pelo ROOT.

## Histórico de checkpoints anteriores à conclusão visual

Fonte executável df9aa83cec1f3c96e9cb1794db58bb3b14021b3b: produtoa86,
harnessbf4 e fixC2 7a. Não contém #319. Node22.23.2 local.

- Unidade global sem filtro de nome ou skips adicionais, maxWorkers2:
  sessão15595 encerrada com exit0,897arquivos/7013testes,238,47s.
  Log privado output/inbox-317-df9-global-unit.log.
- Typegen de rotas seguido de TSC --noEmit --pretty false, heap8192:
  sessão61131 encerrada com exit0. Logs privados *-typegen.log e *-tsc.log.
- ESLint . global: sessão77102 exit0,0erros/42avisos. São40avisos herdados em
  fontes e2em staging privado318 já registrado; nenhuma regra/limite relaxado.
- Recorte ROOT da integração C2 efetivo11arquivos/177testes exit0, descrito em
  output/inbox-317-c2-integracao.md; não somar ao global como testes distintos.

QA independente: produtoa86 13/239, C2 7a 7/37, extensão de identidade df9
5/66, todos próprios do TESTER com exit0. Browser normal TESTER df9 em8contextos,
24PNG/2355203bytes allowlisted, exit0, sem falhas/React/externos; abas, rascunhos,
DOM, foco, alvos44 e agenda semsubmit. Lucas-origem real encerrado demonstra
Responder negado e Nota disponível. Parecer
output/inbox-317-df9-browser-review-tester.md delimita o escopo.

Limite material: a primeira CLI formal16261 terminou exit1 ao selecionar Nota
no protótipo. O nome acessível real contém glifo Lucide, embora textContent seja
Nota interna; footer e app estavam presentes. Humano12/12positivo;6appnota
parciais não contam como rodada formal concluída. A prepara correção isolada
do seletor após stop, sem HTML/props fabricados. Este global não testa o futuro
patch e não homologa a referência que falhou.

DEV normal29367 exit0 em8contextos/24PNG e permissões89958 exit0 em6contextos/
12PNG são evidências próprias do DEV, ainda não empacotadas. Prova C2 ERP longa
com SSE/paginação está em execução separada no TESTER; não usar browser isolado
do autor como substituto. Formal24 atualizado, inspeção/allowlist, gate do patch
do harness, QA C2 real e publicação continuam pendentes. Nenhum deploy ou
integração externa ativado. Banco descartável não é parte da suíte unitária global.

## Patch isolado do seletor e prova C2 real

Patch aa5703 incorporado após QA independente favorável: altera somente a
seleção textual exata no footer do protótipo e exige botão real; produção e
referência permanecem iguaisdf9. ROOT Chrome offline e1a24d exit0,2/2;
harness efetivo8arquivos/51testes exit0 (5/27 b1a235 +3/24 cbffff),TSC12776
e lint2fontes dc9fe5 exit0. Primeiro comando nomeou dois arquivos inexistentes
visual-inbox-harness/identidade, não executados/contados; os três complementares
reais foram identificados por rg. Parecer próprio do TESTER em
output/inbox-317-aa570-note-proto-review-tester.md: Chrome2/2 e Vitest5/44.

TESTER concluiu C2 no ERP df9,2contextos390claro/1440escuro, exec14374/89308
exit0: paginação real159mensagens/4notas/165itens,1491/1→2/2,000foraDOM→pin
visível1/2, mesma área/foco. ROOT emitiu um pg_notify por contexto, cada um
recebeu1SSE e1GET200com body consumido; manual12716 e11859 mantidos, foco
externo preservado, uma fonte ativa,0erros/externos.10PNG1179830bytes allowlisted
e inspecionados. Parecer output/inbox-317-c2-e2e-review-tester.md. Preview23338
parado e snapshotTESTER424hashes1386 restaurado393c28. A original551restaurado
e27558, sem preview. Rodadaformal24 corrigida e global do novo harness pendem.
