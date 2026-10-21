# Incremento 496 — original preservado do aditivo

Data: 15/09/2026. O incremento anterior integrou a conferência de signatários à interface e passou nas integrações; foi progresso. Meta integral permanece ativa.

## Implementação

`ArtefatoAditivoContratual` preserva os bytes do original do aditivo, sua proposta e conferência, autor, motivo, hash do PDF, hash composto da base, páginas e metadados do gerador. Há um único original por conferência. O documento ainda não é assinado e não aplica condições.

O serviço exige Secretaria/Administração ativa, proposta aprovada e vigente, conferência mais recente e hash exato. Revalida a fonte contratual, a decisão, o plano, as identidades e as evidências; documento ativo com URL, nome ou categoria diferentes dos conferidos também impede a geração. Evidências são bloqueadas antes da consulta. A geração limita o arquivo a 10 MiB e preserva a data da conferência no PDF.

O banco protege imutabilidade, unicidade, vínculos, fonte atual, aprovação, versão e autor. Também verifica o prefixo PDF, o SHA-256 dos bytes e o hash composto canônico de proposta/conferência. A comparação completa das identidades e evidências atuais é executada pelo serviço. Migração `20260915063000_original_aditivo` aplicada apenas no banco descartável, com Prisma Client regenerado.

As ações públicas exigem o par matrícula/proposta. A página oferece geração após conferência e histórico paginado com consulta do PDF preservado. A rota exige matrícula/proposta/artefato correspondentes, sessão e papel vigente; usa cache privado sem armazenamento. A leitura verifica o SHA-256 e retorna os bytes gravados, sem regenerar o original.

## Evidências

- **19/19 integrações aprovadas**: `docs/validacao-original-aditivo-final-496-2026-09-15.json`. Incluem geração concorrente nas transações reais, repetição pela ação pública, ausência de nova cobrança/processo de assinatura, rota privada, escopo, conferência antiga, identidade alterada, evidência substituída, hashes recusados no banco e imutabilidade.
- **8/8 unitários de PDF aprovados**: `docs/validacao-pdf-original-aditivo-496-2026-09-15.json`. Verificam determinismo, diferença entre prévia/original, vínculo à conferência, ambiente, fontes e limites da entrada.
- TypeScript e lint aprovados; build em `docs/validacao-build-496-2026-09-15.log`.
- Amostra fictícia `output/pdf/original-aditivo-demonstracao.pdf`, três páginas, SHA-256 `bf794a8d2389628f998701eff11f56bc89f486f06b5c147e95cec709f6516c9c`. Páginas renderizadas e inspecionadas, inclusive detalhe da segunda página; cabeçalhos, rodapés, acentos e último trecho legíveis. Registro em `docs/validacao-visual-original-aditivo-496-2026-09-15.json`. Script reproduzível: `scripts/validar-original-aditivo.ts`.

## Falhas investigadas e limites

A primeira rodada passou 18 e falhou 1. A concorrência entre ações encontrou `ERR_MODULE_NOT_FOUND` no carregamento de `next/server` pelo NextAuth real, apesar da autenticação simulada na suite. O erro ocorreu na fronteira de carregamento do mock. A disputa de geração foi verificada diretamente entre transações PostgreSQL, preservando a conferência real do ator; a ação pública e a rota foram verificadas separadamente. Não atribuir a este ensaio uma execução concorrente de sessões reais no Next.js. Os relatórios iniciais foram mantidos.

Uma execução de TypeScript simultânea ao build encontrou tipos de rota gerados em transição. A verificação foi repetida depois de o build terminar. Não houve alteração dos tipos da rota para contornar o problema.

Ensaio interativo das telas em navegador autenticado permanece pendente. A inspeção visual comprova o PDF de demonstração, não a interface inteira. Não houve envio externo ou publicação em produção.

Continuam pendentes a conferência/liberação para assinatura do aditivo, integração operacional do fornecedor, assinaturas/evidências, aplicação com vigência e aprovações comerciais/financeiras aplicáveis e encadeamento de aditivos já aplicados. A fonte suportada nesta preparação permanece o original contratual. Este incremento não conclui Q117 nem o objetivo integral.
