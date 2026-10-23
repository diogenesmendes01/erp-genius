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

Atualização em 21/10/2026 — port na `main` do contrato de integração com driver simulado (vindo da #62, adaptado). O ERP fala com o serviço de assinatura só pelo port `ProvedorAssinatura` (`src/server/contratos/provedor-assinatura.ts`: criar envelope pela chave da tentativa, consultar por chave, cancelar, baixar assinado; exceção, timeout ou referência vazia são sempre INCERTO). O driver vale por `ASSINATURA_DRIVER` (`provedor-assinatura-ativo.ts`): vazio = registro manual; `simulado` = driver SIMULADO (`provedor-assinatura-simulado.ts`), que guarda os envelopes na tabela `EnvelopeAssinaturaSimulado` e nunca envia nada; outro valor falha. Os processos criados pelo simulado têm fornecedor `SIMULADO` e ambiente `SANDBOX` — o banco recusa `SIMULADO` fora de `SANDBOX` e referência que não seja `sim_…` (migration `20261021500000_driver_assinatura_simulado`), e os guards de efeito contratual real já exigem `PRODUCAO`. Fluxos ligados ao port: envio e conciliação do contrato (`envio.ts`), do aditivo (`aditivo-envio.ts`) e cancelamento por desistência Q165 (`desistencia-cancelamento-assinatura.ts#executarCancelamentoAssinaturaDesistencia`). Trocar para o fornecedor real = implementar um driver neste contrato (com webhook autenticado e conciliação pela chave) e aceitar o novo valor em `lerDriverAssinatura`. Pendente: driver real e webhook (Q155), conclusão automática a partir do assinado baixado, job de conciliação agendado e ambiente de base `HISTORICO` (origem contratual histórica, #285) no envio de aditivo.
