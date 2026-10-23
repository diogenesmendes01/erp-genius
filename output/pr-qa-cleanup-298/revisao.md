# Capturas298 já arquivadas — retirada da reintrodução

Base `5f476a19e88abd2545ecbb717a1b4653ea2b8df1` de main.
O squash394 voltou a incluir64PNG de output/inbox-298-visual, que já estavam
ausentes do head3819e5b5929 e do squash381ea60a8a7. O histórico dos caminhos
mostra a reintrodução em5f476a19. Esta correção retira somente essas cópias
do estado atual, sem reescrever commits ou alterar produto.

Cada um dos64PNG foi comparado antes da retirada: tamanho/SHA256 do arquivo
local, GitOID do blob HEAD e SHA256/tamanho da entrada correspondente no
ZIP autorizado381. Todos coincidiram. TotalPNG3.595.413bytes.
Manifesto com os64 caminhos,bytes,SHA256/GitOID em manifesto.json.

[ZIP já arquivado](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-pr381-1ce8e582.zip):
3.399.189bytes,SHA256
`26a30c20c415b5acb856bfade252b4f0891ecfa6775bfb2700519890a271df8b`.
O pacote já havia sido enviado e baixado/verificado na release em rascunho;
seu hash local foi conferido novamente. Nenhum novo upload ou captura.

Git rm somente do índice; depois as cópias físicas foram movidas para backup
local dedicado com validação de limites absolutos do workspace e hashes
conferidos novamente. Backup/histórico preservados; nada removido de outra
checkout. Zero delta em src/scripts/prisma/package/lock e nenhuma referência
literal a esses PNG em src/scripts. Não há execução de produto a testar
nesse delta; CI e revisão independente do commit exato ainda pendentes.

Na integração das próximas bases, manter a ausência desses caminhos para
evitar nova reintrodução. Sem mudança de permissão, DB, transporte ou deploy.
