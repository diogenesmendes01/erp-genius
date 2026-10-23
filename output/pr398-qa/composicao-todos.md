# PR #398 — composição e todos os comentários

Fonte composta d441c631c55faab0035c6c32a57938a21ae4dade, pais e11d1487 (cherry-pick isolado do patch d5f78f9 sobre ffdd) e 0473b82b (candidata final #397, contendo main3401, B2, QA280 e planejamento297). Nenhum commit futuro das PRs #400–#409 foi incorporado. A publicação aguarda #397 na main.

C1: somente dois blocos do quadro exigiram resolução; ambos os lados foram preservados por parser com contagem explícita. O merge em InboxNovo e nos componentes da lista incorpora apenas os comentários LOW da #397. O backend, schema, migrations e toda a pasta components/conversa permanecem iguais ao patch isolado e11/d5. Package, lock, ESLint e as duas guardas de dependências são iguais à candidata0473. O harness da thread314 mantém suas esperas semânticas, rolagem e três tamanhos; a expressão PW_CHROMIUM da ferramenta B2 foi incorporada. README recebe apenas consolidação da seção de anonimização duplicada pelo merge, mantendo o texto único e o requisito de hidratação.

C2: CI remoto final em dois fusos é gate antes do merge; os testes locais não substituem esses jobs.

C3/C4: correções de dia inválido e autoria vazia incorporadas sem mudanças adicionais. Cinco regressões adicionadas pelo DEV, RED/GREEN nominal e parecer independente favorável no SHA d5, preservados em inbox-pr398-review-todos.md e tester-patch-d5.md.

C5: Hoje/Ontem permanecem um snapshot atualizado por revisão/conteúdo/seleção, sem timer na thread. Uma tela ociosa pode conservar o rótulo após meia-noite; o limite está explícito na SPEC e no teste existente. C6: SPEC relaciona os 12 nomes do plano aos casos reais; nenhuma prova E2E nova foi inferida.

## Gates próprios da composição

- UTC: 13 arquivos / 183 testes, maxWorkers2, terminal0, execução495885; America/Sao_Paulo: mesmo recorte, terminal0, execução556266. Sem filtro de caso ou skips novos. A lista inicial de argumentos incluía NotaNaThread.test.ts, arquivo já removido nesta feature; ele não foi encontrado nem contado. Os 13 arquivos executados são os existentes de balão, dias, eventos, relógio, virtualização, conversa, interaçãoInbox, guardas visuais e dependências. Não é suíte global nem DB.
- Next typegen e TypeScript: sessão37331, terminal0 em b7b921; lint global: sessão99368, terminal0 em7d248f, zero erros / 40 avisos herdados.
- Provas de identidade:13cf40 detectou uma asserção inicialmente ampla demais sobre o harness, pois espera-app/nucleo têm deltas314 legítimos. Inspeção6c9e87 confirmou isso; a asserção corrigida d3fc20 terminou0 e confirmou essas duas fontes iguais e11, guardas/manifestos iguais0473. Nenhuma restauração descartou esses deltas.

Global histórico 867 arquivos / 6.819 testes pertence à fonte671; as capturas314 continuam nominais às suas fontes originais. Não houve novo browser, integração, seed, migração, instalação, mensagem ou deploy.

## Ancestralidade final

#397 integrou por squash b98da363 após CI40013125860, cinco checks verdes e conferência dos comentários; a issue312 está fechada. A árvore inteira desse squash é igual0473. O merge b98 na candidata398 gerou696e6270, com três conflitos por causa da ancestralidade squash. Mantive quadro/README/nucleo já compostos e provei o índice inteiro igual794 antes de confirmar o merge (f824aa, terminal0). Fontes executáveis iguaisd441 novamente em81d112, terminal0. Nenhum gate foi repetido por esse merge de ancestralidade. QA da composição e CI remoto final rodam em paralelo; ambos obrigatórios antes do merge398.
