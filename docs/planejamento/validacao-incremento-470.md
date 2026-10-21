# Incremento 470 — fonte oficial de gravação: conferência e integração necessária

Data: 15/09/2026. Meta integral ativa. Incremento anterior foi progresso confirmado.

## Código e evidência

O adaptador Drive agora oferece `conferirVideoDriveOrganizacional`, que valida identidade, drive institucional, tipo vídeo, estado não apagado e permissão de leitura sem solicitar bytes. A reprodução usa a mesma validação interna antes do stream, preservando validação de Range, descarte de respostas e proteção das credenciais. Essa consulta não concede acesso ao aluno e não garante disponibilidade futura.

A verificação de disponibilidade já existente em `disponibilidade.ts` continua exigindo a leitura de um byte com timeout. Ela deve continuar sendo usada para publicação; a consulta de metadados não substitui essa prova. Nenhuma integração com conta real foi executada.

25 testes aprovados dos adaptadores de Drive, credenciais e disponibilidade: `docs/validacao-gravacoes-470-2026-09-15.json`. TypeScript e lint direcionado aprovados. Testes usam respostas simuladas; não comprovam desempenho, custos ou permissões reais do Workspace.

## Lacuna confirmada no código

Existe `MaterialReposicaoGravacao`, mas não uma fonte oficial própria de AULA. O caminho atual de conclusão da aula é a exceção sem gravação. Q23 aceita somente fonte EXCECAO/null e proíbe mudança da referência. Assim, o fluxo normal e a correção de link aprovada ainda não estão entregues.

## Próxima integração obrigatória

1. Criar registro imutável da publicação de gravação da AULA, separado de material de reposição. Identificar arquivo institucional, publicador, conferência, instante e chave idempotente, sem armazenar credenciais ou URLs arbitrárias.
2. Reutilizar `conclusao-contexto.ts`: chamada histórica completa, conteúdo, professor original, contrato e estado conferidos. Publicação, conclusão e evento devem ser atômicos; obter disponibilidade externa sem manter uma transação aberta durante chamadas de rede, e conferir novamente autorização/estado antes de aplicar.
3. Integrar fonte à projeção Q23 em `correcao-aula-schema.ts`, `correcao-aula-tx.ts`, `correcao-aula-projecao.ts` e novas migrações dos guards atualmente definidos pelas migrations 203/206. Preservar fontes anteriores. Correção de link precisa de proposta e aprovação independente conforme Q23, não de edição livre nem de proibição permanente.
4. Preservar guards de aula ministrada e a exceção Q07. Conferir compatibilidade da transição e ordem dos registros antes de acrescentar proteção SQL que exija prova de conclusão.
5. Integrar tela de publicação e acesso autenticado ao vídeo conforme contrato/matrícula, revalidando permissões e fonte na reprodução. Relatos de indisponibilidade preservam conclusão e histórico, conforme Q57/Q58.

Esta etapa não implementa ainda a persistência/publicação de gravação da aula. Não houve deploy ou mudança em produção. O objetivo integral permanece incompleto.
