# Incremento 480 — regras da substituição contratual Q116

Data: 15/09/2026. Turno anterior teve progresso em testes e SPEC, além de regressão viva. Meta integral permanece ativa.

## Implementação e revisão

Terra implementou `src/server/contratos/substituicao-regras.ts` e testes. O orquestrador revisou a identidade do substituto, a separação entre aprovação e execução e a vinculação da evidência externa à intenção.

As regras exigem preparação por Secretaria/Administração ativa, substituto distinto na mesma matrícula, aprovação por outro administrador e revisão atual da proposta. Autorização de início captura processo, originais, revisões, referência externa e tentativa. Confirmação aceita somente prova correspondente; resultado incerto permanece conciliável e não libera substituto. A existência explícita de conclusão total exige Q117, independentemente de o processo ainda estar no estado ENVIADO. A liberação não herda assinaturas.

A SPEC documental recebeu os requisitos para conectar essas regras a proposta/decisão persistidas, tentativa de cancelamento, retorno autenticado e criação do processo substituto. A revisão identificou que o trigger de processo preserva a base e referência, mas ainda não exige prova aprovada para transição a CANCELADO: essa proteção integra o trabalho pendente.

## Validação

- Quatro testes unitários aprovados pelo orquestrador via `npx vitest`, incluindo múltiplas recusas de divergência, autoaprovação, fonte concluída, resultado incerto e repetição determinística. Relatório: `docs/validacao-substituicao-regras-480-2026-09-15.json`.
- TypeScript e lint dos dois arquivos aprovados.
- O agente informou que tentativas próprias de teste via pnpm não iniciaram o Vitest; não usar essas tentativas como evidência de validação. O orquestrador executou a verificação acima. Versões observadas ao final: Vitest 4.1.11, Vite 8.0.16 e Prisma Client 5.22.0.

### Incidente de dependências e recuperação

O agente esclareceu depois que o wrapper pnpm alterou `node_modules`, moveu dependências para `.ignored` e reconciliou pacotes. Também restaurou `package.json` pelo Git, removendo alterações que já existiam antes desta tarefa. O orquestrador conferiu o arquivo contra a leitura preservada no incremento 476 e repôs exatamente as dependências/versões então observadas: fontkit, google-auth-library, pdfkit, respectivos tipos, Next 16.3.5, next-auth beta.32, eslint-config-next 16.3.5 e override exceljs/uuid 11.1.1. O lockfile npm existente foi preservado. Não realizar nova instalação enquanto a regressão estiver viva.

A regressão ampla que atravessou essa alteração de ambiente serve para investigação, mas não será evidência final de reprodutibilidade. Após seu término, conferir manifesto/lockfile, estabilizar dependências e repetir a validação necessária. O incidente não autoriza relaxar testes nem apagar relatórios.

Após a recuperação, conferência automatizada confirmou que `dependencies` e `devDependencies` do manifesto coincidem com a raiz do `package-lock.json` preservado. Isso não comprova que todo `node_modules` esteja consistente; essa parte continua pendente para depois da regressão viva.

## Regressão de banco em andamento

A sessão `29713`, iniciada no incremento 479, foi consultada e continua viva. Um recorte da saída confirmou 501 testes aprovados em 18 arquivos já concluídos; a suíte continuou depois desse recorte. O resultado final ainda não foi apurado. Não iniciar outro processo de banco nem reiniciar essa execução por falta de relatório terminal. Log e relatório previsto permanecem os registrados em `validacao-incremento-479.md`.

## Limites

Este módulo é uma base de regras internas, ainda sem consumidor operacional. Não grava propostas, não realiza cancelamento, não autentica fornecedor, não gera substituto nem conclui Q116. Essas etapas, a assinatura operacional e os aditivos permanecem no escopo. Sem novo build, validação visual ou deploy neste incremento; não há comprovação de conclusão da SPEC integral.
