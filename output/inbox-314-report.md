# Relatório DEV A — Inbox #314 (parcial)

Base c7e85eb2014bffd9919eedc1808dcb7dcc5b1f24, branch codex/inbox-e1-314, somente worktree inbox-dev-a. Concepção aprovada; fontes/TDD liberados, harness e fixture continuam coordenados. SPEC docs/specs/inbox-thread-autoria-dias.md; plano output/inbox-314-plan.md. Nenhuma instalação, package/lock, schema, permissão ou transporte alterados. Nenhum DB, seed, servidor, envio ou publicação pelo DEV.

## TDD e saídas observadas, Node22.23.2

- RED039852:10falhas novas/5testes E0 verdes em itens-thread, helpers ainda ausentes. GREEN033bf4:15/15. Cobre identidade Você→Camila→Carlos, origem/autor de nota, autores desconhecidos, participantes, calendário/fuso, DST London, ano/bissexto, keys e não mutação da janela. Acrescentados depois retorno do DST e prova pura de âncora na paginação; não alegados como medição DOM.
- RED83fd0b:6falhas novas do balão/15antigos verdes e2módulos de evento/separador ausentes. GREEN545199:4arquivos32testes, incluindo9interações reais ReactDOM do menu305. Execução intermediária812e9a teve9falhas de montagem porque DOM mínimo não implementa SVG; três novos ícones foram acrescentados ao mesmo mock decorativo local já usado pelo teste. Nenhuma alteração no utilitário DOM global ou nos asserts de interação. Lint dirigido da mesma chamada saiu0.
- RED04f466:2falhas novas SSR/page,38antigos verdes; faltavam decoração/padding e instanteISO. Porta de nota aplicada somente após rg confirmar zero consumidores restantes de NotaNaThread fora da própria definição/teste.
- Recorte18156/231c56 exit1:426passaram/1paleta falhou. Causa: classe inexistente text-brand-strong; o token --brand-strong já é text-brand-800. Corrigido utilitário/teste, sem alterar mapa, tokens ou guardas. Lint a4f2bc exit1 também detectou prop agoraThread não encaminhada por uma edição com CRLF, corrigida na renderização; sem afrouxar regra. TSC72524/261cb0 exit0 histórico dessa etapa.
- Recorte6837/6cc1bf exit0:37arquivos429testes (componentes/conversa + Inbox + paleta/botões/contraste-elementos), sem ignorados. TSCheap8192 17cac4 exit0 e lint3e9b58 exit0/0avisos.
- Recorte ampliado6954/2b110f exit0:45arquivos562testes, sem ignorados. Inclui componentes/conversa, Inbox, design-system, contraste, tipografia, paleta, botões, contraste-elementos, responsivo, borda-rota e borda-rota.render, guarda sem-provedores-legados, visual-inbox. Não é suíte completa.
- Refactor posterior reutiliza um formatador Intl por decoração em vez de por mensagem, mantendo saídas puras. Repetição final91616 exit0:45arquivos562testes; TSCheap8192 31722 exit0; lint dirigido d73921 exit0/0avisos. Fonte sem mudanças após esses gates.

## Limites e pendências

Sem full próprio por coordenação: integrador fará global combinado. Nenhuma integração DB executada. Não há foto/medida real314 ainda; classes e renderizações SSR não comprovam geometria. Proposta de fixture/handoff do harness em output/inbox-314-fixture-proposta.md e output/inbox-314-handoff-harness.md; não são seed ou alteração de dados.

Histórico5a43: usava ISO do servidor congelado durante seleção/SSE; contrato substituído pelo checkpoint epoch abaixo. O limite de homônimos permanece sem autorId público.

Aguardar fixture segura, servidor/preview, handoff B312, provas reais de autores/notas/status/dias/Lucas transferido e99→101linhas, fotos3tamanhos×2temas app×protótipo, revisão independente do SHA e global coordenado. Quadro não marca concluído/homologado. 308permanece na própria ref congelada.

## Checkpoint SSR e virada de dia — contrato comum312/314

- agoraThread ISO substituído por agoraInicial?:number. A página contém exatamente o fragmento do B312/a3da8: Date.now uma única vez após resolver fuso, com exceção de purity restrita à linha do Server Component; encaminha número em PropsInboxNovo/ConversaAberta. Não modifica Lista/hook312 nesta branch nem harness.
- useAgoraDaThread usa snapshot serializado no SSR/primeira hidratação,0 neutro quando ausente/NaN/Infinity/fora do intervaloDate. Servidor não consulta Date.now. Getter cliente é cacheado por objeto de revisão (mensagens, notas, seleção e epoch), não uma leitura de relógio a cada getter. Após assinatura usa tempo real; novas mensagens/notas ou seleção renovam a referência. Nenhum timer/listener/intervalo ou polling. Ociosidade total pode manter rótulo; nova mensagem amanhã não conserva Hoje do dia original.
- TDD RED8af03c: módulo novo ausente e3integrações antigas incompatíveis;65testes antigos passaram. GREEN682fb9:4arquivos73testes0. hydrateRoot real comprova primeiro cliente Hoje igual ao SSR23:59 ao hidratar00:01, nó original preservado e onRecoverableError vazio; após assinatura Ontem, nova mensagem00:02 produz Ontem|Hoje. Também troca de seleção/notas atualiza e timers permanecem0. Casos SSR inválidos provam ausência de Date.now.
- Recorte intermediário22087/060b4c exit0:46arquivos567testes; TSC14434/597abe exit0. Lintdf52d2 exit1/1aviso por deps não referenciadas no corpo da memo. Ajustado para revisão explícita memoizada, sem disable da regra.
- Gates do checkpoint final, Node22.23.2: recorte91484/434ae0 exit0,46arquivos567testes sem ignorados (mesmos filtros amplos anteriores mais agora-thread.test); TSCheap8192 46721/c25777 exit0; lint dirigido a6d879 exit0/0avisos; diffcheck0. Fonte sem alteração posterior aos gates. Resultados562/5a43 acima são históricos e não atribuídos ao checkpoint. Nenhum full próprio.
- BancoA/preview livre confirmado ao integrador, sem suíte DB/navegador/servidor pelo DEV. Script privado de preparo314 foi apenas inspecionado por leitura; contratos concretos de Evento NotaInterna/agregado AtendimentoWhatsApp ou Lead/payload.nota/autorId/criadoEm conferidos contra consultas atuais. Integrador informou aplicação de6mensagens+3notas+2autores fictícios inativos no perfildev-email e sanitização307; não é execução/validação DB deste DEV.

Pendências permanecem visual/medidas, revisão independente e global coordenado. Aguardar liberação do preview antes de browser/DB; B312 mantém ownership do harness até handoff.

## Provas privadas e RED real99→101

Preview3110/session61072 preparado e controlado pelo integrador, perfildev-email, transportes vazios; nenhum DB/seed/servidor pelo DEV. Normal25155/499ec0 exit0:6contextos1440×900/1024×768/390×844 nos2temas,24PNGs privados individualmente inspecionados, autoria/sequência/notas/origem/status/dias/Lucas transferido/menu foco-Escape/scroll sem warnings ou tráfego externo. Tentativa5441 preserva falso negativo de sequência própria (Você já vinha do balão anterior), diagnóstico menu4c99f9 comprovou Enter/Escape; sincronização do probe após scroll/focus antesEnter resolveu. Nenhuma correção produtiva por esse ruído. XSS é prova unitáriaSSR, não payload exercitado no browser.

Virtual67184/d40105 exit1 no648:6/6 perdem identidade/foco na transição99→101; desktop/tablet scroll3501→0 e âncora ausente, celular3779→4036/offset80→−535,53. Finitude ausente no primeiro gate de offset foi corrigida somente no próximo probe; RED original preservado em output/inbox-314-visual/virtual-red99-101. Root realizou fases99/101:93/95mensagens+4notas+2dias, só IDs privados novos, sem alteração dos originais307.

TDD direto a42f84 exit1:3novos falharam/4defaults passaram (asserção de objeto gerou serialização React verbosa, substituída por booleano sem mudar critério). Fix stableMount opt-in autorizado: somente thread mantém mesma estrutura; mede/observa scroll antes do limiar e usa layout prévio na transição. GREEN f87638 exit0:2arquivos7testes. A edição da ativação inicialmente tentou caminho de ConversaAberta inexistente; corrigido para app/(app)/inbox antes dos gates amplos. Recorte52058/601831 exit0:47arquivos570testes, mesmos filtros amplos do checkpoint mais VirtualList.estavel. Lint dirigido a4c166 exit0/0avisos. TSC50310 ainda em curso nesta anotação; browser final aguarda reset coordenado. Não é full global nem aceite final.

TSC50310/48f38a terminou exit0, heap8192/Node22; fonte opt-in sem alterações após recorte570/lint/TSC. Probe privado novo teve lint6b06a2 exit1 apenas2variáveis excluídas da serialização sem uso, ajustado mapeamento explícito antes da execução. Reset99 executado somente pelo integrador com guards, removendo apenas084/085privados; aguarda baseline congelado para adicionar novamente.

## Precisão subpixel após primeira correção

Fonte fbfa7115: browser37490/7cfec8 exit1 preservado em virtual-tentativa2-subpixel:6/6 conservaram identidade do nó/pai/raiz/botão, foco, Tab seguinte e scroll; offset ainda79,906→84,969 (celular80,063→85,125), +5,0625px acima do limite2px. Sem warning/tráfego externo. Hipótese reproduzida por TDD56badb exit1: alturas71,75/71,875 próximas da estimativa72 foram descartadas pelo limiar0,5 do cache e acumulavam6,75px; demais3novos testes passaram. Fix altera precisão para0,001 apenas stableMount (default0,5 intacto); GREENe53f1a exit0/2arquivos8testes.

Gates finais desse delta Node22.23.2:93037/204054 exit0/47arquivos571testes sem ignorados; TSCheap8192 61560/94b4e3 exit0; lint dirigido bc6805 exit0/0avisos. Probe privado instrumenta alturas reais antes da transição, soma pré-âncora, root/firstRow/clientTop/listOffset e comparação estilo/top pós, mantendo tolerância2px/identidade/foco; sintaxe/lint f5574c exit0. Nenhum full próprio. Prova browser final ainda pendente de reset guardado2IDs pelo integrador.
