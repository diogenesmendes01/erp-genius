# Inbox #326 — evidência curada da Save R9

A execução DEV R9 terminou com código 0 em 433145, na fonte APP `6f92673dfb526e11ad1e349bea484d135819e849`. A prova preenche a lacuna UI de C1 da revisão da PR #420: uma Save nova com diff fixo, ACK original retido até A2, rascunho B preservado e habilitação de Salvar verificada antes e depois do ACK. QA independente da execução nativa, auditoria ROOT, composição com a main, CI e merge continuam pendentes. Não conclui a issue.

O executor privado tem SHA256 `bbb502fa355e83150b857bdc2097cdaff78995f8eae07a1aababd883e794b0ae`; o helper SSE, `a1184b319783915f91f6c7b8804a98d159a4c96191557fa14240be2bdfb23ebb`. O manifesto bruto permanece privado, ancorado por `739dc9d419d86d2c16f5c62c86e1f18d5a2eb3e06314e9c027efad0557fa92d7`. Nenhum script, request bruto, header, cookie, credencial ou ID interno de ação, Pessoa ou contexto foi incluído no pacote público. Os dados visíveis nas imagens são fixtures fictícias.

## Resultado nominal

| Gate observado | Resultado R9 |
| --- | --- |
| Save real | Uma nova; cumulativo anterior 1, final 2; backend 200. Nenhum segundo submit. |
| Fronteira anterior ao forward | Um request e um handler, ambos da Save atual; zero outra aquisição pendente. |
| ACK antigo e sessões | ACK original entregue após reabertura A2; mesmos nós, foco e rascunhos preservados. |
| Estado React | Salvar habilitado em B e A2, antes e depois do ACK; digitação real e duas frames por prova. |
| Reedição em A2 | Novo texto recebido após ACK; botão segue habilitado, sem submit adicional. |
| Observador completo | 15 requests iniciados e settled; aceitável, zero falhas ou pendências. |
| Rede finita | A: 53 concluídos; B: 52. Ambos com zero pendentes, handlers zero e revisão selada. |
| SSE e fechamento | Um stream e um terminal por ator; requestfailed real observado com Page viva antes de fechar o contexto. Auditoria posterior sem falhas. |
| Recursos e erros | Dois contextos e browser fechados; zero console/pageerror ou falha agregada. |
| Ações incidentais | Leitura automática: 2 ocorrências; leitura de respostas rápidas: 4. Nenhum outro POST de negócio. |

O cap de Save é técnico de cada plano autorizado pelo ROOT. R7 consumiu uma Save e continua EXIT1; o novo plano R9 consumiu outra, com cumulativo 2. Não houve reset de marker, retry autônomo, mensagem, nota ou envio externo. O reset de dados falsos e a conferência dos 498 registros originais foram executados exclusivamente pelo ROOT.

## Mapa de C1 da revisão #420

| Exigência da revisão | Evidência atual | Situação |
| --- | --- | --- |
| Prova UI de Salvar na composição atual | Execução 433145, backend 200, uma Save nova, observador completo e auditoria final. | Atendida na prova DEV R9. |
| ACK antigo não interfere na nova edição | A2 antes e depois do ACK, reedição real, mesmo nó/foco e Salvar habilitado por duas frames. | Atendida na prova DEV R9. |
| SSE não apaga rascunho B | Mesmo input e texto B, botão habilitado, após atualização e ACK. | Atendida na prova DEV R9. |
| Cancelamentos e fechamento não escondem erro | Observador por versão e regras 953 preservados; SSE com terminal nativo antes do fechamento e auditoria posterior. | Atendida na prova DEV R9. |
| Evidência visual verificável | Duas PNGs inspecionadas, originais, hashes e dimensões abaixo. | Curada; revisão independente pendente. |
| Conclusão da PR/issue | Dependente da auditoria, aceite T, composição e CI do integrador. | Pendente; sem closure presumida. |

## Pacote e índice

Arquivo privado pronto para publicação pelo integrador: `inbox-326-aceite-save-6f92673-bbb502fa-r9-20261024.zip`, 224472 bytes, SHA256 `a3606fe159fea66c4447eccd9162cd572eea9f95c79d4c0cc0010704b89bdfc0`. Contém exatamente quatro entradas: duas PNGs, README.md e manifesto.json. As quatro entradas foram reabertas e comparadas por tamanho e SHA256. Os binários permanecem fora do Git; esta entrega textual é o índice.

| PNG | Dimensões | Bytes | SHA256 |
| --- | --- | --- | --- |
| app-A-final-estavel-1.png | 1440×900 | 117109 | 61948b4105b5bd9e10283d71825d2b4566f3edb736c9b7ad3477d2daf9d9a44a |
| app-B-final-estavel-1.png | 1440×900 | 114666 | 707ab3126add4aad48eee74c38740ada4cceba3567e7cafd89262a6db762bc13 |

Manifesto curado: `6c0d03575f8ec8dca85e6b12561dc9aefe8bfd0dfca7e5fb78c806b2966ebeff`. README curado: `d8bf945693dfbc29826d85ad8712a17bffbaa3cfe0d1a603ae83b6c7f05940c5`. Índices: [allowlist](inbox-326-save-r9-allowlist.json) e [ZIP](inbox-326-save-r9-zip.json).

## Limites e histórico preservado

As imagens mostram dois estados desktop 1440×900 da R9. O checkbox Disponível fica abaixo da dobra; não se alega que esta foto exibe todos os campos. As 39 imagens e 13 pranchas históricas continuam nominais às respectivas fontes. As duas PNGs R7 continuam no lote EXIT1, sem republicação neste ZIP.

2588/2bca76, R2–R7 e seus diagnósticos/markers permanecem preservados. R8 é controle positivo delimitado de digitação, cancelamento e fechamento SSE com zero Save; não foi promovido a aceite de aquisição de Detalhes. A R9 usa novamente o observador completo. Nenhum resultado antigo foi convertido em aprovação.

Os 110 testes offline do executor terminaram 999587/EXIT0, com zero skips, mais lint de quatro arquivos. São 89 casos de regressão, oito oráculos R8 e 13 novos; não são a suíte global do produto nem nova integração. Os gates APP/INT/TSC anteriores mantêm suas fontes nominais no relatório da entrega. Não houve alteração de APP, schema, dependências ou comuns visuais para obter a R9.

## Consolidação posterior

Parecer independente R9 SHA256 57ac9a1349f03464cdcdd5d7a24f40c9a62e4db1fb68e161b40130e2e53c5b49, favorável por FS: mesmos nós/foco, ACK original, aquisição, duas PNGs e preservação ROOT conferidos; não foi nova execução UI/DB do TESTER. A matriz visual geral de C1 ficou completa somente com o corpus R10 posterior (seis pares), não por estas duas fotos desktop. [Corpus R10](inbox-326-visual-r10-evidencias.md). Quatro shards CI798f e CI rápida favoráveis; restauro ROOT c1375e EXIT0 preservou498 originais/424 hashes. O ZIP R9 e seus textos internos mantêm bytes/hash e o estado histórico de preparação; esta consolidação não os regrava. Autorização dos anexos, publicação, revisão final e merge seguem pendentes com ROOT.
