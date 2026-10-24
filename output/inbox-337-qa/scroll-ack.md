# QA independente — #337 fix de rolagem do compositor

Fonte exata `ab76f3f6cc921a8057dfac2b2d84454d6a689a49`, pai `d68f678c8af2f17cb815647b68fa514e389c85f7`. Parecer favorável ao recorte de código; prova visual Chromium e entrega integral #337 permanecem com DEV/integrador.

O delta tem seis paths: Compositor adiciona `useLayoutEffect` local que zera `scrollTop` somente depois de `texto === ""` e `campo.value === ""`; cinco testes ReactDOM em arquivo novo cobrem ACK de nota/resposta, erro, ACK antigo e troca de contexto sem key. SPEC, quadro e relatórios registram o caso. O efeito não chama focus, selection, timer ou operação de negócio. Com texto novo ou falha, o predicado impede zerar rolagem; a dependência `[texto, contexto]` faz a reconciliação no commit atual sem resposta tardia agendada. O teste usa simulação explícita da fronteira nativa do scroll do placeholder e não substitui geometria Chromium real.

Verificações próprias: recorte Node 22.23.2 de `Compositor.scroll.interacao`, `Compositor.rascunho.interacao`, `Compositor.mencoes.interacao` e `Compositor.test`: 4 arquivos, 82 testes, executor `9e0cf3`, terminal 0, sem filtro por nome. `git diff --check` executor `431d3d` terminal 0. Diff backend/schema/deps (`src/server`, `prisma`, manifests) vazio, executor `f2d286` terminal 0. Não repeti 46 integrações da fonte a3bc porque esses arquivos permaneceram iguais; elas são evidência histórica nominal, não execução em ab76.

Limites: teste DOM mínimo controla `scrollTop` como oráculo da regressão, mas não mede placeholder, caret ou clipping num browser. Não rodei DB, Prisma, TSC, lint global, preview, nem a negativa visual restante. Nenhuma conclusão sobre o pacote visual final #337 a partir deste recorte.
