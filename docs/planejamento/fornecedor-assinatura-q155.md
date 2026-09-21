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
