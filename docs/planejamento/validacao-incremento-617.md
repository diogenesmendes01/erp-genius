# Incremento 617 — processamento dos e-mails de acesso

16/09/2026.

O worker `src/server/portal-aluno/processar-envios.ts` consulta somente PREPARADO, processa até 20 solicitações serialmente e devolve cursor para continuar a varredura. Cada despacho conserva a claim transacional existente. INCERTO não é reenviado automaticamente. Erros de regra entram na contagem de pendências; falhas de configuração/infraestrutura interrompem o lote.

`POST /api/portal-aluno/envios/cron` exige `x-cron-secret` correspondente a `CRON_SECRET` e habilitação explícita `EMAIL_PORTAL_ENVIO_ENABLED=true`. Valida cursor e não expõe erro interno. Não foi configurado agendador nem realizado envio externo. O exemplo de ambiente mantém a função desligada.

O consumidor de convite passou a conferir o contato atual também ao usar um link já enviado. Alteração/remoção do endereço impede ativar a credencial antiga antes de consumir token, gravar senha ou criar sessão. Contas já estabelecidas continuam com o fluxo próprio de alteração de identidade.

## Validação

- 16/16 testes unitários de worker, rota e identidade/recibo: `docs/validacao-unitaria-final-617-2026-09-16.json`.
- TypeScript e ESLint dos arquivos alterados: exit 0.
- Caso de integração despacho → mudança de contato → consumo bloqueado acrescentado em `envio-resend.int.test.ts`; ainda não executado para não concorrer com a regressão 611, sessão 20856, confirmada ativa.

## Operação e pendências

O agendador deve percorrer `proximoCursor` até null e iniciar uma nova varredura sem cursor na rodada seguinte. Isso permite avançar além de preparações pendentes de conferência. Aceitação pelo provedor não comprova entrega na caixa postal.

Ainda faltam tela operacional, tratamento explícito dos resultados incertos, homologação real e configuração do agendador. A defesa da troca de contato no consumo está na aplicação; a proteção SQL equivalente e a revisão de concorrência/ordem de locks precisam integrar a próxima migração, após terminar a regressão ativa. Nenhuma migração foi criada/aplicada neste incremento.

Não representa conclusão global da comunicação nem atualização automática do percentual das SPECs.
