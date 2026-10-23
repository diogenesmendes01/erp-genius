# Evidências da issue #308

[ZIP sanitizado de revisão](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-308-evidencias-2f68.zip), asset667561603,8.005.192bytes.

SHA256: `6d88e5a7d2c810eafb137db9b30eca82622e96b20c658d9ad3a4563ec1ff9704`.

Upload e download conferidos na release **draft** autorizada. O pacote tem48PNGs:38capturas formais app×protótipo,4complementares390×500 e6pranchas, com hashes individuais. O app usa telefones fictícios0300–0307; o protótipo recebe anonimização explícita do DOM antes da foto, preservando o HTML original. Não inclui negativos ou HTML bruto.

Fonte integrada2f68e8f4, anterior às mudanças312/314: formal29530 exit0,0falhas,16diagnósticos de GET cancelado e recuperado. Complemento de formulário/foco/resize ce367d exit0. Todas as38formais e os complementos foram inspecionados. Pareceres no ZIP identificam suas fontes próprias; não se presume nova QA independente no agregado2f.

Global19074:857arquivos/6.680testes unitários e TypeScript exit0, sem filtros ou ignorados. Lint final66935 exit0:40avisos herdados. Sem envio externo ou deploy. Limite preexistente da confirmação de opt-out está no relatório e não é declarado corrigido.

Os40PNGs históricos foram retirados apenas do índice após confirmação do depósito remoto; cópias locais e commits anteriores foram preservados. JSONs/probes versionados registram tentativas históricas; o pacote acima é o artefato sanitizado para revisão.

## Curadoria das sondas históricas — revisão #395 C7

Os cinco arquivos MJS desta pasta são sondas da execução original e permanecem para explicar as medições e tentativas registradas nos JSONs. Seus caminhos de Chrome/Windows refletem o executor daquele momento: não são ferramentas portáveis nem entradas de CI. O harness reutilizável atual fica em scripts/visual; não se promove nem executa automaticamente uma sonda histórica. Os 18 arquivos (306.161 bytes no corte da auditoria) foram avaliados como um conjunto pequeno de proveniência; o aceite visual sanitizado é o ZIP já indicado acima. Nada nesta curadoria gera nova captura, amplia homologação ou reenvia imagens antigas.
