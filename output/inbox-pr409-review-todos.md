# PR409 — todos os comentários R1

Base exata58b2d4b8574772dc70232cbe05188041c03cfe99, branch própria codex/inbox-pr409-review-todos. Review remota5633341791 recarregada em23/10/2026,19:51UTC, por conectores GitHub read-only. Inventário anterior409comments=[]; nova reviewCOMMENTED com veredito textualAPPROVE e nove comentários, sem threads inline/respostas posteriores no momento da leitura. Head/base remotos confirmados58b2/DDF. Workflow_runs[]/statuses[] não são CI verde; não houve comentário/push/retarget/merge por este DEV.

## Disposição C1–C9

| Comentário | Resposta técnica/contrato | Situação |
| --- | --- | --- |
| C1 HIGH PII de convidado sem contatos.ver | Decisão humana expressa via integrador: “Permitir esses dados para qualquer convidado autorizado na conversa comercial”. Confirma projeção atual de Pessoa/empresa/participantesB2B, sem matrizCRM nova. Acrescidos3INT não vazios com FINANCEIRO/PROFESSOR/GERENTE_PEDAGOGICO e negativos. | Contrato aprovado documentado; nenhum gatePII/runtime alterado; resultados finais abaixo |
| C2 HIGH INT no head final | Executar painel-detalhes.int.test.ts e paineis.int.test.ts completos no patch409, perfildev-email/Ready15a7ee/snapshotE2; não substituir por nominais anteriores. | Recorte próprio nominal abaixo; integração final após composição continua do integrador |
| C3 MEDIUM CI | Nenhum CI disparado/forjado; o head final elegível a main exige gates remotos. | Pendente integrador |
| C4 MEDIUM pilha/main/QA280 | Não copiar main parcial nem perder contratos de pais. As correções recentes398d5 e40269c precisam compor o head integrado; não foram portadas nesta branch isolada409. | Pendente integrador |
| C5 MEDIUM quadro com397 | Preservados históricos, append exclusivo desta revisão. | Conciliação final pendente integrador |
| C6 LOW B2B principal/interlocutor | SPEC já fixa contato efetivo em naConversa/subtítulo/decisor e pessoa principal na ficha; reforçada referência paraTask16/UI. Teste B2B existente preservado. | Respondido documentalmente; sem mudança de resolver |
| C7 LOW subtitulo vazio | Contrato explícito stringvazia quando B2B sem dado; futura324 deve tratá-la como ausente. Nenhuma UI nova é alegada. | Intencional documentado |
| C8 LOW leituras duplicadas | carregarDadosSetor e contextoPainel continuam consultas separadas; não consolidar sem preservar identidade/Db/escopo. Custo não perfilado, sem promessa de snapshot atômico. | Aceito como limite/otimização futura, sem refatoração especulativa |
| C9 LOW nomes de testes | Tabela na SPEC liga os critériosTask3 aos it/it.each reais e aos casos maiores/regressões, sem renomear/reduzir testes. | Mapeado |

## D13 aprovada e autorização

A investigação privada anterior output/inbox-pr409-investigacao-review-dev-a.md identificou corretamente que acesso ao resumoLead por convite era legado e a projeçãoPessoa/empresa/participantes era nova323. Sua proposta de gatecontatos.ver foi SUPERADA pela decisão humana posterior, registrada no próprio relatório privado para evitar interpretá-la como contrato vigente.

Exceção autorizada somente em Detalhes da conversaCOMERCIAL já acessível por convite vigente/autorização do lead. Não altera capacidadesCrm, verContato global, /contatos, /empresas, edição/tags/envio/Aria. camposDaPessoa continua exigindo contatos.ver; foraCOMERCIAL não há Pessoa/oportunidade/B2B/campos nesse DTO e telefone pedagógico segue restrito. Resolver, regra6, lead negado/semPessoa, fallback apenassemlead/escopoPessoas e passagem do mesmoDb/pool1 permanecem intactos.

Nenhum runtime foi necessário: a fonte58b2 já implementava o comportamento aprovado. Não existe RED artificial de uma alteração produtiva inexistente. A execução inicial com fixture inválida não é apresentada como RED do produto.

## Testes novos não vazios

Único delta src: src/server/inbox/painel-detalhes.int.test.ts, import puro capacidadesCrm e três expansões de:

D13 aprovado: %s convidado comercial recebe Pessoa/empresa/B2B sem contatos.ver; ausência, revogação, expiração e outro setor não ampliam acesso.

ExpansõesFINANCEIRO/PROFESSOR/GERENTE_PEDAGOGICO. Cada uma verifica contatos.ver=false; cria email/cidade/cargo/linkedin/origem/telefone reais fictícios, empresa com documento/segmento/porte/site e dois participantesB2B com papéis/cargos e principal diferente do interlocutor. DTO completo com convite vigente, lead e decisor corretos. Campo personalizado preenchido e tagativa são primeiro visíveis ao dono, depois campos[]/catálogo[] do convidado provam restrições sem vacuidade. Sem convite, revogado e expirado negam Detalhes/cabeçalho/pessoaDoAtendimento. Novos atendimentosPEDAGOGICO/SECRETARIA/FINANCEIRO com aluno/matrícula/contato coerentes e convite vigente continuam semPII. O convite usa o defaultpodeEnviar=false do domínio; regressão completa paineis.int preserva o teste específico de envio/convidados.

painel-detalhes.int passa de13 para16 casos expandidos; paineis.int conserva12: total esperado28nos2arquivos, sem filtro de nome/skips adicionais. Os13anteriores, incluindo linha alheia/legal/catalogoP2/pool1/cobertura/revogação, não foram removidos ou alterados.

## Ambiente e operações externas

ReadyROOT15a7ee terminal0:424tabelas/553registros,487migrations, snapshot323A e nenhuma operação ativa. Perfil local .erp-test-profile=dev-email confirmado no checkoutaa5595. Node22.23.2/localvitest, configintegration, maxWorkers1, fileParallelismfalse, provedores externos vazios. Uma única suíte A por vez. Banco foi reservado/inícios/sessões comunicados aoROOT; DEV não executou SQLmanual/Prisma/schema/migration/cluster/seed307/preview/browser/envio.

## Evidências de execução

- Primeira integração13895 (8d24f9→14e9c4) TERMINAL1:2arquivos/28testes,25pass/3fail,72,73s. As três falhas ocorreram na fixture nova ao tentar reclassificarCOMERCIAL→PEDAGOGICO; trigger existente recusou corretamente Atendimento histórico não pode ser reclassificado como pedagógico. Os asserts positivos/semconvite/revogado/expirado já haviam passado, mas a execução inteira falhou e não é aceite parcial da issue.
- Corrigida exclusivamente a fixture: novos atendimentos setoriais com aluno/matrícula/contato como no casoD13 existente; nenhum trigger ou produção relaxado.
- Unitários b372ff:8arquivos/102testes, saída0,1,73s,maxWorkers2, sem filtro/skips adicionais. Essa execução precede a correção final da fixtureINT: fonteprodutiva e arquivosunitários não mudaram, mas não é apresentada como QA da fixturefinal. Arquivos: painel-detalhes.test,painel-abas.test,paineis-tags.test,visibilidade-lead-db.test,permissoesInbox,permissoesCRM e as duas rotaspainel.test.
- TSC pré-correção48750/b9b1b3 e lint1682c5 eram0; gates finais após a fixture corrigida são TSCa49124 (--noEmit/heap8192) TERMINAL0 e lintdelta/diffcheck289c8e TERMINAL0, --max-warnings0. Não usa os gates anteriores para afirmar tipos/lint da fixture final.
- Integração final77363 iniciada67f239: resultado terminal registrado no fechamento após observar o mesmo executor. Sem chamar recorte de global.

## Identidade/fonte e pendências

Comparação original0c61→58b2 só acrescentava dois relatóriosQA/107linhas; src/scripts/prisma/package/lock eram idênticos, conforme investigação com OIDs. Esta revisão acrescenta um arquivoINT e documentação; a produção, schema/SQL, dependências, scripts/harness e outros testes são preservados. C2 nominal desta branch não substitui testes/CI no futuro head após retarget/main/QA280 e portes de398/402. Não se copia parcialmente o helperDOM402 ou a decoração398 nem se modifica leituraR6/SSE.

SPEC docs/specs/inbox-painel-detalhes-abas.md, decisão docs/planejamento/inbox-decisoes-produto.md, quadro único e este relatório são os únicos MD propostos ao commit. Nenhum PNG/HTML/logbruto/probe/credencial é adicionado. Sem push/CI/merge/homologação presumida. QAindependente exata e restauração final do bancoA pelo integrador permanecem coordenadas.

## Fechamento observado

Integração77363→656ebf TERMINAL0:2arquivos/28testes,67,82s,maxWorkers1, sem filtro de nome/skips novos.16casos detalhes (13preservados+3novosD13) e12paineis. BancoA liberado aoROOT imediatamente após terminal; sem nova suíte/servidor/browser. Restauração do snapshot peloROOT é gate externo separado. TSCfinala49124 e lintdelta/diff289c8e são posteriores à única correção de fixture e terminaram0. O warning MIXED_EXPORTS/Vite existente não motivou mudança de configuração.

Blob do teste efetivamente executado: 30f7ec7bfcea7eb0ec2020c84d43aa6a68b9f951; SHA256 local b53efc39a062c48ba25a9096c3b02da971f6d746b6db21256757be6eb750e62c. MDposterior não altera esse objeto. Produção preservada contra58b2; o único src diferente é esse INT. Finaldiffcheck e allowlist conferidos antes do commit. C1contratohumano+regressão atendidos; C2recorte nominal409 executado, C3–C5integração/CI/pilha/documentação e QAindependente exata seguem coordenados, sem presumir merge.
