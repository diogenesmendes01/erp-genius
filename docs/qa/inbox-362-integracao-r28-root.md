# #362 — integração pública do servidor e da decisão pedagógica

Base pública: PR454dd449ac. Origens selecionadas: servidorb76c94e5 e extensãoGP546cfedd, com a correção de concorrência333 herdada. Os patches são limitados às respectivas entregas; o quadro público foi composto preservando todo o histórico. Nenhum ancestral privado foi importado. Schema Prisma, dependências e a origem500 permanecem fora do delta.

### #362 — composição pública com cancelamento próprio do gerente pedagógico, R28

Selecionados o servidor de agendadas do checkpointb76c94e5 e a extensão autorizada no checkpoint546cfedd sobre a PR454dd449ac. A correção SHARE da333 já está herdada, sem reaplicar sua política antiga sobre a exceção. Sem ancestrais privados, schema Prisma ou pacotes novos. Migrações501/502 mantêm os bytes reservados/aplicados no ambiente DEV e serão aplicadas explicitamente pelo integrador no ambiente de QA.

A decisão humana permite ao gerente pedagógico ativo que criou uma intenção manual/HUMANO e continua responsável pela conversa cancelar o próprio agendamento pelo Inbox, com ACL de leitura fresca, sem exigir tarefas.ver. O CRM global conserva suas permissões. O painel e a action usam a mesma regra do núcleo, com revalidação após esperas; estado encerrado não acrescenta veto quando os critérios expressos continuam satisfeitos. IA, outro autor e perda de papel/atividade/responsável não entram na exceção.

DEV confirmou113UNIT/7arquivos e24nativos completos no checkpoint final (aceite5,claim1,LISTEN7,ciclo11), além dos recortes históricos qualificados no QA. Os negativos reais comprovam recusa após perda de responsável/papel durante a espera pelo pai, sem Evento ou aviso da operação. Fontes, contagens e leases constam nos registros DEV; não são QA independente desta composição. BancoDEV restaurado pelo integrador. QA pública exata, regressões integradas e CI ainda pendentes; não concluirissue antecipadamente.

O trigger genérico502 substitui apenas o trigger específico501 e preserva sua função histórica. Notifica os atendimentos OLD/NEW válidos sem atualizar a PK ou travar o pai e mantém o payload compacto do barramento. Os dois SQLs são imutáveis e recebem proteção LF. Nenhuma migração é aplicada implicitamente pelos testes.

Pendências desta publicação: preparo explícito do banco descartável pelo integrador, QA independente do SHA público, gates de TypeScript/unidade/integração pertinentes e CI. Rascunho parcial; sem fechamento automático da issue.
