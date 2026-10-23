# Aceite visual TESTER — #298

Fonte da aplicação capturada: SHA exato `a384afd736c7ce5838c55c1e4483a822fee3b4c6` no worktree `inbox-tester`; servidor local `localhost:3109`, banco descartável `tester`, fixture fictícia, número BAILEYS desconectado. Baseline anterior: `36334f27` mais pré-requisito Windows, capturado pelo integrador no banco `integracao`. Nenhuma mensagem real ou serviço externo foi acionado. O script `output/capturar-inbox-e0.mjs` produziu **12 capturas depois** (lista/conversa × 1440×900, 1024×768, 390×844 × claro/escuro), exit 0, manifesto com `pageerror=[]` nas seis combinações. Comparei visualmente cada par com as 12 capturas antes do integrador.

## Estados conferidos

- **Lista não lida, contador 2:** em 1440×900 e 1024×768, claro/escuro, o badge antes era quase invisível por `bg-brand` sem CSS. Depois há círculo sólido legível em verde, com 2 visível. Em 390×844 a lista ficava abaixo da primeira dobra; capturas adicionais após rolagem mostram o mesmo badge legível nos dois temas.
- **Conversa selecionada:** nos três tamanhos e dois temas a abertura mostrou as três mensagens fictícias, ações e painel disponíveis antes/depois; #298 não altera o estado de leitura, então o contador 2 permanece após abrir. O ícone ✓✓ da mensagem `LIDA` está verde e visível depois. Em 390×844 capturei após rolar o ícone para a área visível, porque o screenshot padrão parava acima das mensagens.
- **Estilos medidos no navegador em todas as seis combinações:** badge claro `rgb(27,135,85)` com texto branco; badge escuro `rgb(33,192,99)` com texto `rgb(10,10,10)`; ✓✓ claro `rgb(21,96,62)` e escuro `rgb(33,192,99)`. Os valores constam de `output/inbox-capturas/depois-298/detalhes.json`; os quatro screenshots móveis adicionais terminam em `badge-visivel.png` e `lida-visivel.png`.
- **Painel lateral:** rótulos secundários e campos de oportunidade aparecem legíveis em desktop claro/escuro. No tablet/celular o painel lateral depende do drawer e não foi aberto nesta automação; a revisão visual deste estado específico permanece pendente.

## Limites e observações

A fixture não contém enquete nem devolução de crédito; portanto **EnqueteLeitura** e **DevolucaoCredito** não receberam aceite visual. A troca de classes nesses componentes foi coberta por revisão/testes dirigidos, mas isso não substitui a captura exigida para homologação integral. O quadro não deve marcar esses estados como vistos.

O overlay do Next dev mostrou `1 Issue` ou `2 Issues` em algumas capturas de conversa, tanto antes quanto depois, embora o coletor `pageerror` tenha registrado zero. A análise estática aponta um possível aviso de chave repetida em componentes irmãos do painel (`InboxNovo.tsx`, preexistente ao #298); o stack/log do overlay ainda precisa confirmar a causa. Não observei perda das mensagens nem do ícone ✓✓ associada a esse aviso. Essa observação não é atribuída à mudança de cor.

As imagens estão em `output/inbox-capturas/depois-298/` no worktree TESTER; as 12 imagens antes estão em `output/inbox-capturas/antes/` no worktree do integrador. A fonte visual `a384afd7` antecede o ajuste posterior do detector de testes (falso positivo em `botoes.test.ts`), que não muda as classes de produção. Gates globais e aceite visual dos estados ausentes continuam separados deste parecer.
