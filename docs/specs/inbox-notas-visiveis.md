# Inbox E0.4 — notas internas na thread (#301)

Estado: implementação em revisão em 22/10/2026; aceite visual e homologação pendentes.

## Contrato

- `fonteErp` preserva a resposta da rota: `notas: null` significa manter a coleção no histórico; `notas: []` significa substituí-la por vazio. O campo é opcional em `PaginaHistorico` para compatibilidade com fontes falsas; ausência equivale a nenhuma alteração. A abertura inicia com coleção vazia. Troca de atendimento e `limpar` apagam as notas do anterior e descartam respostas atrasadas.
- A carga inicial, a reconexão e cada página `depois` substituem a coleção quando recebem um array. `antes` conserva as notas. Uma página `depois` sem mensagens novas ainda publica as notas, inclusive `[]` após arquivamento. `atendimento.atualizado` usa o caminho de reconciliação do histórico; duas sessões autorizadas atualizam sem recarregar o navegador.
- A thread intercala mensagens e notas por instante. No empate, a mensagem vem antes da nota; ids ordenam empates do mesmo tipo. A chave virtual da nota recebe `nota:` para não colidir com a da mensagem. Enquanto restarem mensagens anteriores, notas anteriores ao instante mais antigo da janela ficam ocultas; depois de carregar até o início, aparecem. Notas não consomem o limite de 600 mensagens nem mudam os cursores.
- `NotaNaThread` usa um cartão tracejado de aviso, alinhado à direita, com rótulo inequívoco de conteúdo só da equipe e origem atendimento/oportunidade. Mostra autor ou ausência de autor, conserva quebras e texto escapado e formata hora no fuso de exibição. Não oferece comandos de mensagem nem transporte ao contato.

## Aceite

Testes funcionais de fonte, histórico, aviso, troca de conversa, ordenação/janela, componente da nota e composição da thread; recorte de Inbox/design system; TypeScript, Vitest completo e ESLint global com saída 0. Aceite manual com fixture fictícia, duas sessões, 1440×900, 1024×768 e 390×844 nos temas claro e escuro, com antes/depois e nota arquivada. A #300 fornece escopo de rota e aviso transacional; esta issue não muda permissões, schema ou transporte.

Referências: issue #301, [quadro único](../planejamento/quadro-entregas.md).
