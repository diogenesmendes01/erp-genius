# Incremento 497 — conferência interna do original do aditivo

Data: 15/09/2026. O incremento 496 preservou o original com verificação e testes, portanto foi progresso. A meta integral continua ativa.

## Implementado

`ConferenciaAssinaturaAditivo` preserva a revisão do original, a autoria, o motivo e a chave idempotente. A conferência exige Secretaria/Administração ativa, escopo matrícula/proposta/artefato correto, proposta aprovada, participantes vigentes e hash de revisão exato. O estado revalida a fonte, as identidades, evidências, PDF, base composta, modelo, ambiente e ordem dos signatários.

O snapshot é montado pelo servidor. A migração `20260915064000_conferencia_assinatura_aditivo` protege os vínculos e a imutabilidade e compara os hashes/vínculos, versões, modelo, ambiente, vigência e participantes ordenados com os fatos preservados. Prisma Client regenerado; migração aplicada somente no banco descartável.

Uma nova tela acessível pelo histórico dos originais permite abrir o PDF preservado, conferir os signatários e a vigência e registrar a revisão. O histórico continua disponível quando o original deixa de corresponder à conferência atual; nesse caso a consulta mostra pendência e não apresenta revisão válida. Consultas verificam a integridade do snapshot e projetam apenas os campos necessários, sem chave idempotente ou snapshot bruto.

Esta conferência não resolve alçadas comerciais/financeiras, não envia documentos, não recebe assinaturas e não aplica condições. Esses efeitos precisam de implementação e comprovação próprias.

## Verificação

- **22/22 integrações aprovadas**, em `docs/validacao-conferencia-assinatura-aditivo-497-2026-09-15.json`. Incluem as 19 anteriores e três cenários novos: idempotência/concorrência nas transações reais e leitura histórica sem envio; papéis/escopo/revogação/base superada; rejeição de participantes, modelo, versão e ambiente adulterados em INSERT direto.
- TypeScript aprovado antes do build; lint dos arquivos alterados aprovado; build aprovado em `docs/validacao-build-497-2026-09-15.log`.
- A sessão é simulada nos testes; não houve ensaio concorrente de autenticação real nem ensaio da nova tela em navegador.

## Acompanhamento global solicitado pelo usuário

O levantamento inicial foi registrado em [cobertura-global-497.md](cobertura-global-497.md): 18 macrofrentes, sendo 14 com entregas parciais documentadas e quatro sem evidência suficiente de conclusão. É um levantamento documental preliminar, não uma auditoria integral do código de cada frente e não uma porcentagem do produto implementado. Não converter aprovação dos 22 testes de aditivo em progresso percentual global.

Os relatórios gerais continham cabeçalhos históricos desatualizados. A cobertura por capacidade e a prova de cada critério de aceite ainda precisam ser consolidadas antes de informar uma porcentagem global defensável.

## Próximo trabalho

Representar os efeitos contratuais de aditivos de forma tipada, identificar alçadas comerciais/financeiras e impactos acadêmicos aplicáveis e integrar assinatura/formalização/aplicação com vigência. `alteracoes.novo` ainda é texto e a base ainda parte do original sem cadeia de aditivos aplicados. Não chamar os serviços de condições de entrada para reescrever condições de uma matrícula já aceita. A assinatura operacional depende também da escolha/configuração do fornecedor. Nada foi publicado ou enviado em produção.
