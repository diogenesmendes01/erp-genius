# Incremento 410 — relatos da equipe e descarte

2026-09-14. Q57 ganhou registro explícito de relato pela Secretaria/Gestão/Administração e pelo professor com designação vigente para a reposição. O relato não cria indisponibilidade automaticamente. Gestão pode descartar somente relato aberto da mesma reposição, preservando-o e registrando motivo e autoria em Evento da matrícula. O descarte não altera uma pausa existente nem o prazo de entrega.

Os formulários foram conectados à fila docente, à visão da Secretaria e ao painel da gestão. Não houve validação visual.

## Verificação

- **11/11** testes operacionais passaram, incluindo publicação, consulta, liberação, confirmação/retomada e os quatro cenários novos de relatos/descarte. Relatório: `docs/validacao-relatos-equipe-410-2026-09-14.json`.
- **9/9** testes unitários do adaptador Drive passaram, com respostas simuladas. Isso não comprova acesso real ao drive da escola.
- Build Next completo passou: compilação, TypeScript, 61 páginas estáticas e rotas dinâmicas. Sem implantação.

## Reprodução ainda em implementação

Adaptador de bytes está implementado, mas faltam integração da rota/player, validação do guard de autorização, credenciais, acesso real ao Drive e ensaio operacional. A concessão específica de entrega não libera vídeo de matrícula pausada/encerrada. O provider de autenticação usará a biblioteca oficial, conforme [orientação Google para aplicações servidor](https://developers.google.com/identity/protocols/oauth2/service-account), sem criar ou ativar credenciais nesta etapa.

O escopo integral ERP/CRM/WhatsApp/acadêmico permanece incompleto.
