# PR #403 — compositor e comentários da revisão

Fonte337832c083d508caab6bfb5eae2c3e2a04703805, pais ea1fcf25 (cherry-pick a5b8 documental sobre68e) e4027b1d2ca1. Um bloco do quadro preserva ambos os lados. Nenhuma feature319/E2 foi antecipada; os pais397–402, B2/QA280/planejamento297 e o Pick do cabeçalho são preservados.

C1 HIGH/C6 LOW: composição local conciliada; publicação aguarda402main, CI global final em dois fusos e auditoria fresca. C2 MEDIUM: Nota por visibilidade individual inclusive ENCERRADO permanece em menu/rodapé, grupo sem Nota e demais gates intactos. C3 MEDIUM: os17casos ReactDOM/StrictMode do rascunho permanecem, inclusive A→B→A, limpeza sem edição e proteção de intenção posterior/owner compatível. O controlador do compositor, suas fontes/testes e ações de mensagem são iguais ao pai403ea1; a única diferença na Conversa é a remoção de importtype/props órfãos399. Seu JS emitido é igual ao pai (47efc5, terminal0), sem mudar ciclo de troca de alvo.

C4 LOW: SPEC esclarece que trocar modo descarta File e gravação temporários; texto tem rascunhos separados. Upload iniciado pode terminar sem despachar a URL antiga; envio já despachado não é cancelado. Nenhuma promessa de preservação ou cancelamento retroativo foi criada. C5 LOW: mapa nominal e distinção entre CSS, capturas e17testes reais na SPEC. C7 LOW: inventário22saídas/1826linhas e curadoria mantidos, sem apagar auditoria.

## Gates próprios e QA

- Recorte f7aa42, terminal0:11arquivos/241testes, America/Sao_Paulo, maxWorkers2; todos os11caminhos conferidos existentes antes da execução. Sem filtro de caso/skips novos. Inclui compositor/rascunho, conversa/rodapé/busca, ações de mensagem, balão/interação, interaçãoInbox, hook de busca e guardas visual/dependências. Não é suíte global nem DB/browser.
- Typegen/TypeScript89337/b086ec e lint global61306/bb66aa terminais0, zero erros/40avisos herdados.
- Provas26ca5f/080888/47efc5 confirmam compositor/ações/troca de alvo preservados, patchShift402 e dias/autoria398 intactos, schema/manifestos/lock iguais ao pai402. Nenhuma alteração de transporte ou autorização de servidor.
- QA documental a5b8 favorável, original SHA256 f543f685192997d305c46739264d5892cf9c656f637f8e38a9acf4550f219e9f, em tester-patch-a5b.md com apenas EOF normalizado. Os8/102 do DEV são nominais ao patch documental/68e; o parecer não executou novos testes/DB/browser.

QA composta337 é favorável estática: compositor/rascunho/rodapé/ações/menu/ReactDOM iguais ao paiea1; busca402/thread398/alias400/Pick401/B2/schema/QA297 iguais7b1; Conversa só remove tipos/props órfãos, com JSX/hooks intactos e triagem real no Inbox. Nenhuma execução de testes/DB/browser no parecer. Original SHA256 695b09d280a602c3c8a24ab167e870b2aa43c9331c1759fa2981cae0399abb1e, em tester-composicao-337.md com apenas EOF normalizado.

Incorporação de402f060 acrescentou registros/ancestralidade sem alterar a fonte337; um bloco do quadro preservou ambos os lados. #402 integrou por squashd7255884 após CI40019446915 success5/5, com retry somenteSP no mesmoSHA após a primeira tentativa atingir20min; issue316 fechada. A árvore inteira do squash é igualf060. Sua incorporação à403 gerou12conflitos de ancestralidade, mantidos na candidata já composta; o índice inteiro foi conferido igual278da27b antes do commit. Nenhuma fonte, teste ou documento distinto mudou, sem repetir gates por esse merge.

CI final403 em dois fusos ainda é obrigatório. Global899/7.046 pertence à fonte741; capturas317 e complemento de menuC2 conservam suas fontes nominais e não comprovam C3 ERP. Nenhuma recaptura, instalação, migração, banco, seed, envio ou deploy nesta composição.
