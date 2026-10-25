# Revisão R1 e regressões de integração da #345

A revisão R1 aprovou a composição `b5ef8d61` sem bloqueadores. A publicação mantém as permissões e o contrato de eventos existentes; não amplia o trigger global para supervisão, versão publicada, motivo isolado ou INSERT inicial de AgenteIA.

- C1: a integração F96 terminou com três shards aprovados e duas falhas no quarto. O histórico e os skips estão em [ci-f96.json](ci-f96.json). O próximo head precisa passar antes do merge.
- C2: a #344 já está incorporada. Conflitos documentais com #420/#427 serão resolvidos nas próprias composições; o conflito de `page.test.ts` da #427 vem da main.
- C3: os limites do aviso global permanecem explícitos. A #347 deverá rever o produtor se passar a exibir supervisão ou versão.
- C4: o coalescedor existente continua responsável por repetições. Observar o volume após implantação é uma recomendação operacional; não foi criado polling ou feita implantação nesta entrega.
- C5: `globalValido`, `avisoRecarregaPainel` e seu teste foram formatados. Comparação das folhas da AST com F96 confirmou, respectivamente, 628, 5.834 e 2.602 tokens idênticos nos três arquivos, sem diagnósticos de parse; lint dos três passou.
- C6: espaçamento do trecho novo do quadro foi corrigido e o corpo da PR atualizado. Os pareceres históricos são mantidos com suas fontes e limites; não há logs brutos ou segredos no pacote público.

O inventário PostgreSQL passou a declarar explicitamente `notificar_inbox_acao_ia`, preservando a consulta, a igualdade fechada, os hashes da BASE e a conferência dos triggers. O [parecer antes/depois](pg-proc-f96-tester.md) registra a reprodução e a aprovação nominal F96.

Os dois testes antigos de nota SUGERIR/SHADOW esperavam nenhum aviso. O INSERT de AcaoAgenteIA agora invalida o atendimento por quatro campos de identificação, mesmo quando a nota ainda não foi aplicada. O [parecer causal e RED](crm-f96-red-tester.md) confirmou ambos. O candidato exige exatamente esse único aviso e reforça a ausência de Evento NotaInterna, intenção ou mensagem de saída e os IDs nulos de efeitos. Os controles de execução real e rollback permanecem intactos. Nenhuma alteração de runtime ou migration foi necessária para corrigir essas expectativas.
