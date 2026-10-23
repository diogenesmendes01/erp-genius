# Curadoria de evidências do Inbox após as revisões

Capturas geradas são evidências históricas, separadas das imagens canônicas do plano e dos testes executáveis. Para as revisões #382 C4/C6, #383 C5 e #384 C1, os lotes `inbox-299-visual` (25 PNGs), `inbox-302-visual` (48) e `inbox-303-visual` (24) saem do índice atual. Os manifestos e pareceres permanecem identificados como registros da execução original.

Antes da retirada, as 97 imagens locais foram comparadas aos blobs do commit main `8c079d491f3ce8cba1bc03936f131d7ecf9e817e`. Um arquivo ZIP local de 4.484.568 bytes foi criado e suas 97 entradas foram reabertas e conferidas por SHA-256. Seu hash é `fc84c7c070c10e5bfc478594894d7f4bb2ca40c9d8c8f9d9ed5ffb2b6e56b76a`. O [catálogo](../../output/inbox-posmerge-arquivo-capturas.json) registra cada caminho, tamanho, blob e hash.

A retirada usa somente o índice Git: os arquivos físicos, o ZIP local e o histórico original são preservados. O ZIP antigo não é publicado nem enviado a um serviço externo. As imagens canônicas da documentação do plano ficam fora desse recorte. Esta curadoria não gera capturas, não altera pixels nem apresenta testes antigos como uma nova execução.

Os README de cada conjunto registram a retirada junto aos caminhos antigos. Novas evidências devem usar o pacote sanitizado e verificável da respectiva entrega, sem reintroduzir imagens históricas removidas.
