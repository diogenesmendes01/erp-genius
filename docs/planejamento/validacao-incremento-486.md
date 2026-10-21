# Incremento 486 — ações e telas de proposta Q116

Data: 15/09/2026. Turno anterior foi progresso: migração, serviços de proposta/decisão e testes reais de contratação. Meta integral ativa.

## Implementação

`src/server/contratos/substituicao.ts` expõe ações autenticadas de preparação pela Secretaria/Administração e decisão por outro administrador. Autoria vem da sessão; as primitivas mantêm a conferência de permissões atuais e das condições na transação. Consultas paginam propostas e conferências de substitutos, sempre pela matrícula identificada. O detalhe exige simultaneamente matrícula e proposta corretas.

As consultas projetam conteúdo histórico, autoria/motivo/data, estado da decisão e o necessário para selecionar a conferência e decidir a proposta exata. Não retornam PDF binário, referência do fornecedor, chave idempotente ou snapshot interno. O detalhe mostra os textos preservados de ambas as prévias, os signatários identificados e as condições de taxa/reserva de cada revisão. As URLs dos PDFs usam a rota autenticada existente.

Incluídas páginas `/matriculas/[id]/contrato/substituicoes` e `/matriculas/[id]/contrato/substituicoes/[propostaId]`, acessíveis pela página de documentos. A primeira permite selecionar um substituto conferido, abrir os originais, justificar e preparar; o detalhe compara as duas versões e permite a decisão independente. Versão superada pode ser rejeitada, mas não aprovada. A interface oculta decisão do próprio preparador; o servidor também a impede. Paginação separada evita omitir conferências e propostas antigas.

As telas informam que cancelamento externo e envio substituto ainda não estão disponíveis. Aprovação não é apresentada como substituição executada.

## Validação

- `docs/validacao-substituicao-acoes-final-486-2026-09-15.json`: oito testes de integração passaram. Incluem os cinco cenários transacionais anteriores e três novos sobre ações, projeção/isolamento e acesso: Secretaria prepara, Administração decide, textos antigo/corrigido preservados, matrícula incorreta negada, vendedor/professor/financeiro negados, usuário desativado recusado e ausência de campos internos nas respostas.
- A primeira execução de ações também passou: `docs/validacao-substituicao-acoes-486-2026-09-15.json`. A execução final foi feita após acrescentar a projeção das condições/signatários.
- ESLint direcionado passou. Build Next.js terminou com código zero, compilação e TypeScript aprovados, 63 páginas estáticas e as duas rotas dinâmicas novas: `docs/validacao-build-486-2026-09-15.log`.
- Revisão Terra somente leitura não apontou defeito comprovável de vínculo, autorização ou aprovação obsoleta nos serviços. A verificação do hash canônico completo do snapshot está no serviço; o SQL verifica identidade/imutabilidade e correspondência com `entradaHash`, sem recalcular esse hash.

## Limites e próximo passo

Não houve homologação visual em navegador autenticado nem teste real do serviço externo de assinatura. O build comprova compilação das telas, não execução visual dos formulários. Persistir intenção/prova de cancelamento, conciliar resultado incerto e consumir a aprovação para criar o processo substituto continuam necessários. A integração externa e Q117/aditivos seguem pendentes; não houve deploy ou envio real. A última regressão ampla permanece 968/968, anterior a estas adições, complementada pelos testes direcionados acima.
