# Escolha do fornecedor de assinatura — Q155

Estado em 12/09/2026: pergunta enviada ao usuário, sem resposta registrada. Nenhum fornecedor/plano contratado ou configurado por esta pesquisa.

Atualização em 15/09/2026, incremento 489: pergunta reapresentada com ZapSign, Clicksign e Docusign; continua sem resposta registrada. O trabalho independente da escolha segue em andamento.

| Opção | Capacidade documentada relevante | Validação ainda necessária |
|---|---|---|
| ZapSign | Criação por API com idioma português/espanhol e grupos sequenciais para participantes. | Conta e plano/API, autenticação, correspondência de retornos, cancelamento, conciliação e condições aplicáveis aos participantes da escola. |
| Clicksign | API de envelopes/signatários com grupos e notificações; documentação atual anuncia verificação HMAC dos webhooks. | Versão da API, plano, identificação de signatários, idioma e operação efetiva da sequência. |
| Docusign | Ordenação paralela e sequencial; documentação oficial de autenticação HMAC do Connect. | Conta/plano da API, autenticação, configuração Connect e homologação do fluxo completo. |

Recomendação técnica inicial apresentada: ZapSign, pela documentação explícita de português/espanhol e grupos compatíveis com Q122. Trata-se de avaliação de encaixe técnico, não comparação conclusiva de preço ou validade jurídica. Não foram fixados preços ou plano. As três opções precisam ser homologadas antes da operação.

Fontes oficiais consultadas:

- [ZapSign — criar documento](https://docs.zapsign.com.br/documentos/criar-documento).
- [ZapSign — grupos de signatários](https://docs.zapsign.com.br/signatarios/grupo-de-signatarios/definir-grupos-de-signatarios).
- [Clicksign — signatários e grupos](https://developers.clicksign.com/v2.0/docs/adicionar-novo-signat%C3%A1rio-no-envelope).
- [Clicksign — portal da API](https://developers.clicksign.com/).
- [Docusign — ordem de assinatura](https://www.docusign.com/en-gb/blog/quick-tip-setting-signing-order).
- [Docusign — HMAC para Connect](https://www.docusign.com/blog/developers/manually-authenticating-hmac-signatures-docusign-connect-webhook-configurations).

O ERP pode avançar no registro interno de intenção/tentativas sem escolher um fornecedor. Essa infraestrutura não comprova integração. A aplicação não deve interpretar timeout ou erro de rede como certeza de que nenhum processo foi criado. Antes de repetir, exigir resultado conclusivo ou conciliação autenticada com o fornecedor escolhido.

Atualização em 21/09/2026 — contrato de integração independente do fornecedor. `src/server/contratos/provedor-assinatura.ts` define o port `ProvedorAssinatura` (criar envelope pela chave da tentativa, consultar por chave, cancelar, baixar assinado), as chamadas "sem presumir" (exceção, timeout ou referência vazia são sempre INCERTO; só resposta positiva do fornecedor vira NAO_CRIADO/AUSENTE/CANCELADO) e um driver SIMULADO em memória, aceito apenas com `ASSINATURA_DRIVER=simulado` fora de produção. Sem a variável não há integração e as telas permanecem no registro manual. `src/server/contratos/envio.ts` orquestra o envio do contrato: confirma processo e tentativa no banco, chama o fornecedor fora da transação e registra o resultado em outra transação (`registrarResultadoEnvioTx`); `conciliarEnvioAssinatura` trata ENVIANDO/ENVIO_INCERTO pela chave da tentativa. A tela do original (`contrato/originais/[artefatoId]`) oferece "Enviar para assinatura" somente com driver ativo e conferência registrada para a revisão atual, e "Conciliar envio" para envio pendente. A desistência ganhou `executarCancelamentoAssinaturaDesistencia` (intenção Q165 → cancelamento no fornecedor → observação CONFIRMADO/INCERTO), ligada à conferência documental; a efetivação já reconhecia o cancelamento confirmado. Pendente: driver real e webhook autenticado do fornecedor escolhido (Q155), conclusão automática a partir do assinado baixado e job de conciliação agendado. Aditivos usam o mesmo protocolo (`enviarAditivoParaAssinatura`/`conciliarEnvioAditivo` em `aditivo-envio.ts`), oferecido na tela do original do aditivo apenas quando o driver ativo coincide com o fornecedor/ambiente do processo preparado. Verificação: unitários do provedor 7/7 e SSR das duas telas; regressão unitária 2.102/2.102, TypeScript sem erros. Orquestradores não possuem teste de integração com banco nesta entrega.
