# Incremento 613 — preparação da persistência de revisão

## Implementado

Helper puro fonte-revisao.ts converte os campos persistidos em RevisaoDriveFixada do adaptador, rejeita legado/incompleto e compara a identidade integral. Tamanho permanece string/bigint, sem perda por Number, respeitando limite positivo do BIGINT PostgreSQL.

credenciais-publicacao.ts obtém token separado para a retenção keepForever. Requer configuração explícita GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_EMAIL e GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_PRIVATE_KEY. A reprodução conserva obterTokenDrive com drive.readonly. Nenhuma credencial foi consultada/exposta e nenhuma permissão externa foi concedida nesta entrega. O novo token ainda não está ligado à action de publicação.

## Preparado, não aplicado

[rascunho-146-revisao-drive.sql](rascunho-146-revisao-drive.sql) adiciona colunas/checks/guards previstos para publicação e material. Está fora de prisma/migrations: precisa de revisão SQL executada, atualização dos chamadores/fixtures e alinhamento do Prisma antes da aplicação. Não foi criada/aplicada migration146 nem alterado o banco durante a regressão611.

## Evidência

19 testes focados passaram, zero falhas: docs/validacao-unitaria-final-613-2026-09-16.json. Lint focado passou. TypeScript passou durante preparação; repetir após alterações de schema/chamadores. Regressão integral611 permanece ativa na sessão20856.

## Pendências

Concluir a integração dos adaptadores e da persistência no fluxo real. Legado não pode ser preenchido com a versão atual presumida. Publicação/correção precisa respeitar aprovação e identidade histórica. Configuração externa e homologação de retenção/reprodução continuam separadas dos testes simulados.
