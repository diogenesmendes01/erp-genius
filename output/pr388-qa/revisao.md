# PR #388 — C2/C3/C4

C2: maisNovas sem cursor usa recarregar, que conserva as notas enquanto a
consulta está em voo. Em erro comum, notas continuam e o erro aparece; troca
ou perda de acesso mantém a limpeza de geração anterior. O consumidor atual
não esconde a coleção por carregando. A mudança mantém exclusão mútua e a
repetição pendente, sem timer ou novo pedido de escrita.

C3: itensDaThread recebe quarto parâmetro obrigatório temMaisDepois. Notas
fora da borda superior ficam ocultas quando faltam mensagens mais recentes;
as bordas são inclusivas e calculadas mesmo com mensagens fora de ordem.
ConversaAberta repassa ambos os indicadores. Contrato coordenado com o outro
integrador para os consumidores novos da314; não usar default que esconda
caller sem atualização.

TDD: seis casos novos falharam na fonte anterior (46passes/6falhas). Após
correção,3arquivos/52testes passam, sem filtro/ignorados. Casos cobrem coleção
preservada durante consulta e erro, SSE de outro atendimento, duas bordas,
empates, consumidor SSR e corte real do histórico com600mensagens, seguido
da recuperação da nota ao avançar.

C4: retirados36PNGs, não40. O número40do pacote original inclui4metadados.
Uma guarda inicial esperava40PNGs e parou antes de retirar/mover qualquer
arquivo; a contagem foi conferida contra9a201c28 e corrigida. Todos36foram
comparados individualmente por tamanho/hash antes de sair do index. ZIPlegado
SOMENTELOCAL4.162.790bytes/40arquivos, SHA256
cb4b02a5a1aeffed2efa4d99f257dc6aa77068ae110f54f3922e268cd92651cc.
HistóriaGit preservada, semforce ou novo upload de capturas antigas. README
emanifesto na pasta original. Isso não é nova homologação visual.

Base385corrigida +387/386/R6/main1a56031 recebida por merges normais.
Gates globais, revisão independente e CI ainda pendentes. Sem banco/schema,
permissão, motor ou transporte real alterados nesta revisão.

Gates finais Node22.23.2: full73171 saída0,845arquivos/6566testes semfiltro/skip
(maxWorkers=2); TSC84277 saída0; lintglobal92738 saída0,0erros/40avisos herdados.
O teste de600 usa a classe real do histórico com fonte em memória1260mensagens,
não PostgreSQL. Sem novo browser/DB/snapshot visual após esta correção.
