# Inbox #325 — Detalhes comerciais e participantes B2B

## Contrato

A apresentação comercial consome o DTO autorizado de #323 e os destinos produzidos pela #336. Não resolve atendimentos no navegador nem concede capacidade de envio. O participante atual recebe “Na conversa”; os demais recebem “Falar com” somente quando `hrefConversa` não é nulo. Empresa, Pessoa e oportunidade mantêm suas identidades distintas.

O cabeçalho utiliza o subtítulo e o formato de avatar projetados pelo servidor. A oportunidade atual exibe produto ou título, valor na moeda do registro e etapa, sem periodicidade mensal presumida. Enquanto #327 não fornece a aba Oportunidades completa, o cartão navega para `/funil?o=<id>`. Nenhuma aba vazia é habilitada.

Contato/perfil/empresa usam `LinhaCampo`; dados nulos ficam explícitos. A marca “Preenchido pela Aria” depende da autoria já projetada no DTO. “Abrir ficha completa” e “Ver empresa” exigem suas capacidades próprias; um convite comercial não autoriza essas fichas globais.

D13 segue o esclarecimento humano da PR409: dados contextuais podem ser lidos pelo convidado atualmente autorizado no atendimento comercial, preservando filtros de Pessoa legal, carteira/linha e campos personalizados. Não ampliar a matriz de permissões. Documento e nascimento opcionais LATAM continuam na #340; não acrescentar CPF/idade/preferências na #325.

## Aquisição e composição

O hook `useAbaPainel` portado isoladamente da #326 faz GET no-store somente para Detalhes comercial ativo, por chave atendimento/aba/versão/tentativa. Abort e identidade de contexto impedem a apresentação de respostas antigas. Loading, erro com Retry e ausência legítima são estados distintos. Não há intervalo ou nova assinatura SSE.

A integração futura da #326 reutilizará esta mesma instância para Detalhes ativo OU editor aberto; o editor não integra o escopo desta entrega. Fora do comercial a composição E1 permanece; ações Aria, contato, opt-out e triagem continuam abaixo dos detalhes conforme os gates existentes.

## Verificação e pendências

Testes de apresentação e composição estão em preparação. Os gates exigem cliente/perfil487 fornecidos pelo integrador e saída terminal observada. Nenhuma execução em cliente490 será atribuída a esta base487. Aceite visual, QA independente, integração, CI e publicação permanecem pendentes. Harness pertence à frente326 e não é alterado nesta fase.

## Checkpoint DEV — 24/10/2026

Base `8d843c06e52eaf78d2232a3033be10d0e9b59650`, ramo `codex/inbox-e2-325`. Produtores de Detalhes, capacidades e links B2B da #336 permanecem sem alteração; não há migração nem delta de dependências. Hook e teste portados isoladamente de `2de9d10b82b52a5d6b1492d3553eec4d3551c22c`, com blobs idênticos.

RED por asserções: nove falhas em onze testes antes da apresentação. GREEN inicial: três arquivos e 22 testes. O recorte causal final passou com 69 arquivos e 726 testes. A suíte unitária geral final passou com 924 arquivos e 7.252 testes (sessão 4380, terminal 45dc6b, 157,10 s, quatro workers). Integração final: três arquivos completos e 41 testes (sessão 32745, terminal d4e174, 229,96 s, um worker). TypeScript com heap 8192 (95233/20aaf5) e lint dos nove arquivos (2c76f9, warnings máximos zero) terminaram com código 0. Não foram usados filtros por nome nem testes ignorados nessas execuções.

O banco descartável ci-integracao487 foi fornecido e restaurado pelo ROOT antes da rodada final; a lease foi liberada após a saída terminal da integração. O restauro posterior cabe ao integrador e não é presumido neste checkpoint. Nenhum submit manual, preview, captura ou envio real foi executado para a #325.

A entrega é revisável localmente. Aceite visual dos estados Detalhes/B2B, QA independente, integração, CI e publicação continuam pendentes. A #325 não está concluída nem homologada. Detalhes dos comandos, negativos e limites estão em `output/inbox-325-report.md`.

## Ajuste textual D13/LATAM

Após o checkpoint `05588ca5`, o rótulo passou a “Documento da empresa” por aprovação do ROOT, sem alterar `empresa.documento` ou o contrato de dados. O teste usa documento PJ chileno fictício e não cria campo de Pessoa. RED `c9d894` e GREEN `97434/447bf9` (69 arquivos/726 testes, 17,10 s), além do lint dos dois arquivos `116014`, foram observados com saída final 0 no GREEN/lint. Global, TSC e integração anteriores permanecem atribuídos a `05588ca5`; não foram repetidos para esta cópia. Visual e QA continuam pendentes.

## Harness visual325

A extensão separada preserva190 combinações953 e acrescenta30 (total220): Pessoa e B2B com referências reais c1/c2; convidado APP-only/N/A de autorização por convite. O preflight exige dois GETs reais, IDs/credenciais explícitos e contrato D13; prontidão valida corpo, destinos, capacidades, forma132 e documento contido. Guardas críticas de hidratação, semântica318/324, rodapé, cancelamento recuperado e React permaneceram idênticas953.

Gates do harness: 16 arquivos/115 testes `7a72c9` (2,80 s), TSC `226547`, lint14 `fbda5b` e syntax4 `74e4b9`, todos EXIT0. Nenhuma nova integração, aplicação de fixture, navegação HTTP/browser ou captura. Fixture/plano privados foram entregues para inspeção ROOT e novo READY; dados originais/canônica não foram alterados. O preparo do harness não encerra o aceite visual/QA da #325.
