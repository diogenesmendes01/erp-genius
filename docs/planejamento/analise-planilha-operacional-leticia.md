# Análise da planilha Operacional Leticia para migração

**Análise em 10/09/2026.** A planilha é uma fonte útil de cadastro e acompanhamento financeiro parcial. Ainda precisa de complementos e conciliação para a entrada em produção. O original foi examinado em leitura, sem importação no ERP ou alteração do arquivo.

Fonte: `C:\Users\Mendes\Downloads\Operacional Leticia (2).xlsx`. Referência de escopo: [checklist solicitado em Q85](checklist-dados-migracao.md).

## 1. O que já existe

Foram examinadas as sete abas, incluindo valores, fórmulas, observações, vínculos entre IDs e campos vazios. Linhas apenas formatadas ou com fórmulas sem aluno não foram contadas como cadastros.

| Aba e intervalo de dados | Conteúdo encontrado | Aproveitamento |
|---|---|---|
| Cadastro Alunos, A5:O110 | 106 registros com ID único, nome, contato, situação e tipo de cobrança. 100 e-mails preenchidos, 93 documentos, 94 referências de turma | Base de identificação e cadastro, com complementos e conferência |
| Cadastro Turmas, A5:K46 | 42 registros com ID único: 38 marcados Ativa e quatro Aguardando. 24 são particulares, nove regulares, seis semi-intensivos, dois intensivos e um agrupamento sem modalidade | Base de turmas/ofertas; distinguir grupos reais, particulares e agrupamentos temporários |
| Histórico Matrículas, A5:H93 | 89 movimentos, cada um associado a um aluno diferente. Todos os IDs de aluno e turma referenciados existem nos cadastros | Base inicial de vínculos. Não comprova histórico completo de contratos ou transferências |
| Mensalidades 2026, A4:AH110 | Acompanhamento de julho a dezembro, com situação, data, valor e observação por mês. Moedas CRC e USD | Fonte de registros financeiros a estruturar e conciliar. Os campos mensais não são um livro completo de recebimentos |
| Alterações Semanais, A5:I18 | 14 registros; 13 com data. Há cancelamentos/inativações, remanejamentos e mudança de preço | Evidência complementar para regularizar situação e histórico |
| Resumo Operacional, A4:H11 | Contagens por situação e soma dos valores por moeda | Resumo derivado da aba de mensalidades, não uma segunda fonte de pagamentos |
| Instruções, A1:B11 | Orientações de uso da planilha | Contexto para interpretar as colunas; não é cadastro nem autorização para executar os procedimentos descritos |

No cadastro de alunos há 73 Ativos, 26 Inativos e sete Aguardando. Os valores de moeda estão preenchidos em 105 registros: 61 CRC e 44 USD. Há 91 cadastros classificados como Mensal e 15 como Por hora. São classificações da fonte, não confirmação de contrato ou recebimento.

## 2. Comparação com os dados solicitados

| Grupo do checklist | Situação nesta planilha | Complemento necessário |
|---|---|---|
| Alunos | Disponível parcialmente | País do cadastro, fuso, e-mails ausentes/incorretos e conferência dos documentos/contatos compartilhados. Nascimento e endereço quando necessários e disponíveis |
| Responsáveis legais/financeiros | Não há cadastro estruturado | Nome, contato, vínculo com aluno, papel legal/financeiro e autorização de comunicação. Há menções em texto, como pagamento pelo pai ou por empresa, que precisam ser vinculadas |
| Equipe e acesso | 11 rótulos distintos de professor no cadastro de turmas | Cadastro completo com nome, e-mail, situação e função/papel. Nomes nas turmas não comprovam usuários ou permissões |
| Cursos, níveis, modalidades e planos | Há nomes de modalidades e valores individuais | Idioma/nível de cada turma, ordem dos níveis, meta de aulas, catálogo/planos e regras aplicáveis. Menção pontual a B1 em observações não preenche os níveis das demais turmas |
| Turmas e agenda | Dias/horários e professor em parte dos registros | Fuso, datas reais de início, nível/meta, capacidade e regularização de turmas temporárias/sem grade. Término futuro será calculado pelo ERP; término real de turma encerrada precisa de evidência |
| Matrículas e contratos | Vínculos iniciais por aluno/turma | Contrato da matrícula, aceite, condições, datas reais e períodos efetivos de entrada/saída. Distinguir contrato/matrícula de cada passagem por turma |
| Cobranças e cobertura | Situação mensal, moeda, valor cadastral e parte dos vencimentos | Identificador da cobrança, valor efetivamente devido por período, cobertura inicial/final, descontos/acréscimos, taxa de matrícula e situação conciliada |
| Recebimentos | Valores e datas parciais, inclusive detalhes em observações | Movimento individual de pagamento, referência/comprovante, valor/moeda, data, meio, pagador e alocação às cobranças/períodos |
| Créditos, antecipações e devoluções | Antecipações e saldos pontuais descritos em texto | Origem, valor, período coberto, usos e saldo. Não há controle estruturado completo de créditos/devoluções |
| Aulas e frequência | Menções pontuais a aulas em observações financeiras | Diário por encontro, professor, conteúdo, alunos elegíveis e chamada. Uma anotação de pagamento por aula não equivale a presença confirmada |
| Gravações e reposições | Não foram encontrados links de materiais ou registros estruturados de reposição | Relação aula → arquivo do Drive, pedidos/particulares, entregas, avaliações e cotas, se já existirem |
| Pausas, transferências e encerramentos | Parte das alterações está em texto | Datas efetivas, situação correta, origem/destino, motivo e decisões existentes. Separar pausa, encerramento e inatividade cadastral |
| Calendário escolar/disponibilidade docente | Não há calendário institucional estruturado | Fuso oficial, feriados/recessos/férias e ausências docentes aplicáveis |
| Leads e negociações | Não encontrados como conjunto próprio | Carteiras, etapas, origem, histórico e vínculos com alunos, se existirem em outra fonte |
| Preferências de comunicação | Contatos preenchidos, sem evidência estruturada de autorização por finalidade | Canal, finalidade, permitido/recusado/desconhecido e origem/data da informação |

“Não encontrado” refere-se a este arquivo. Não significa que a escola não tenha a informação em outro lugar.

## 3. Conferências pontuais para o time

Os números abaixo representam campos preenchidos/ausentes e divergências de fonte. Não devem ser interpretados como autorização para corrigir ou fundir registros automaticamente.

| Item | Evidência | Solicitação objetiva |
|---|---|---|
| Seis e-mails ausentes | Cadastro Alunos: E22, E24, E67, E69, E87, E88 | Completar os endereços individuais necessários aos convites do portal |
| Três e-mails com estrutura que exige revisão | Cadastro Alunos: E53, E77, E91 | Confirmar a grafia/endereço. A conferência foi sintática, sem teste de entrega ou verificação da caixa |
| 13 documentos vazios | Cadastro Alunos: F22, F24, F49, F53, F69, F77, F78, F87, F88, F91, F92, F94, F108 | Complementar quando necessário ao cadastro/contrato; informar tipo e país emissor. Não considerar qualquer texto preenchido como documento validado |
| Contatos compartilhados | Cadastro Alunos: pares D24/D27, D25/D28, D31/D32 e D97/D104 | Confirmar se é telefone de responsável, contato compartilhado ou erro cadastral |
| Mesmo e-mail e documento em dois IDs de aluno | Cadastro Alunos: E97/E104 e F97/F104; os nomes são diferentes | Identificar vínculo familiar/financeiro ou corrigir a origem. Não mesclar os dois alunos por suposição |
| 12 alunos sem ID de turma atual | Cadastro Alunos: G34, G89, G94, G95, G97, G102, G103, G106:G110 | Confirmar a situação/alocação aplicável. Inativo ou aguardando pode legitimamente estar sem turma |
| 17 alunos sem linha no histórico | Cadastro Alunos: linhas 94:110; ausentes no Histórico Matrículas | Informar entrada e alocação quando aplicáveis, ou registrar por que não há vínculo |
| Datas iniciais marcadas como provisórias | Histórico Matrículas: 76 linhas com 01/07/2026 e observação pedindo revisão da data de entrada | Solicitar datas reais ou outra fonte que as comprove. As demais 13 linhas também são uma carga inicial, não histórico completo |
| 25 alunos Inativos com vínculo histórico Ativa, sem saída | Histórico Matrículas e Cadastro Alunos: linhas 7, 8, 9, 10, 14, 15, 30, 39, 40, 41, 47, 49, 50, 51, 52, 53, 55, 56, 57, 58, 62, 73, 76, 79, 81 | Confirmar se houve pausa, encerramento ou mudança de turma e as datas efetivas |
| Vínculo atual versus histórico | Linhas 34 e 89: cadastro sem turma, histórico com turma; linha 90: IDs de turma diferentes entre as duas abas | Confirmar o vínculo vigente e a sequência das mudanças |
| Turmas com poucos dados temporais | Cadastro Turmas: somente H5, H45 e H46 têm início; 39 inícios e todos os términos estão vazios | Informar início real e estado das turmas. Para turmas em curso, fornecer nível, meta e aulas já realizadas; não inventar data final |
| Professor/grade pendentes | Professor vazio: linhas 20, 44, 45, 46. Dias, horário e horas/aula vazios: linhas 20, 40, 41, 44, 45, 46 | Confirmar se são rascunhos, remanejamento ou aulas sob demanda e completar o que for necessário à publicação |
| Quatro IDs temporários | Cadastro Turmas: linhas 20, 44, 45, 46 | Definir correspondência com a turma definitiva, conservando o ID de origem para rastreabilidade |
| Situação de turma divergente entre abas | Cadastro Turmas C13: Ativa para turma 30; Alterações Semanais, linha 12: relato de inativação do grupo | Confirmar situação vigente e eventual reativação posterior |
| Horário ambíguo | Cadastro Turmas G21: “10-12am”; não há fuso das turmas | Confirmar início/fim e fuso. Outros horários estão em texto, com dias em espanhol; serão normalizados após conferência |
| Mudança sem data/tipo | Alterações Semanais, linha 13, relata mudança de mensalidade | Informar quando passou a valer, condições e referência de aprovação/acordo existentes |

Os 106 contatos têm 11 dígitos e estão armazenados como texto. Isso ajuda a preservar o número; não comprova país de residência, identidade do titular, autorização para mensagens ou validação do telefone.

## 4. Financeiro: o que precisa ser conciliado

Existem 49 dias de vencimento informados e 57 vazios. Entre os 91 cadastros classificados como Mensal, 49 estão sem o dia de vencimento. Há um cadastro sem moeda e valor (linha 72), cuja observação descreve uma permuta por aulas de espanhol; esse caso precisa de tratamento próprio, não preenchimento automático com zero.

| Mês | Situações Pago | Pago sem valor no campo mensal | Pago sem data no campo mensal | Situações Parcial |
|---|---:|---:|---:|---:|
| Julho | 61 | 6 | 31 | 2 |
| Agosto | 34 | 8 | 9 | 3 |
| Setembro | 5 | 4 | 4 | 0 |
| Outubro | 4 | 4 | 4 | 0 |
| Novembro | 3 | 3 | 3 | 0 |
| Dezembro | 3 | 3 | 3 | 0 |

As duas colunas de ausência podem contar o mesmo registro; não somá-las como pessoas distintas. Os totais são ocorrências aluno/mês, não quantidade de alunos únicos nem confirmação bancária de pagamento.

Parte das lacunas é explicada por antecipações: as observações das linhas 21, 43, 46 e 74 de Mensalidades 2026 descrevem curso pago integralmente, ano pago por empresa ou particulares antecipadas por quatro meses. Para importar corretamente, precisamos do recebimento original e da cobertura/alocação, sem lançar um novo recebimento em cada mês marcado Pago.

Há informações úteis que já podem ser extraídas das observações: N78 e N83 descrevem pagamentos individuais por aula em julho; R78 descreve pagamentos e saldo de agosto. As células L78/L83 agrupam várias datas em texto. Esses dados devem ser estruturados e conferidos, aproveitando o que já existe, sem pedir que o time reescreva tudo.

Conferências específicas:

- Julho: valor ausente nos registros Pago das linhas 21, 29, 43, 46, 49 e 74.
- Agosto: valor ausente nos registros Pago das linhas 21, 43, 46, 54, 74, 94, 97 e 101.
- Particulares por hora: identificar valor/hora, horas cobradas/realizadas, adiantamentos e saldo. O campo chamado Mensalidade não deve ser importado como preço mensal para esses 15 cadastros.
- Mensalidades 2026, linha 94: julho está Não cobrar com valor 210; agosto está Pago sem valor. Conferir a alocação e o significado do registro antes de classificá-lo.
- Responsável da aba financeira está preenchido apenas em duas linhas. Não é cadastro suficiente de responsável legal/financeiro com contatos e vínculo.
- Janeiro a junho não estão representados no controle mensal. Solicitar esse histórico se a escola tiver operação anterior que precise ser trazida, além dos recebimentos prévios que sustentam antecipações atuais.

As somas por moeda do Resumo Operacional coincidem aritmeticamente com os valores numéricos da aba de mensalidades. Isso não comprova conciliação bancária: as fórmulas somam os valores registrados por moeda, sem filtrar exclusivamente Pago/Parcial, e existem recebimentos anotados em mês diferente da data efetiva. A célula B11 soma 110 ocorrências Pago entre meses, não 110 alunos.

## 5. Efeito no planejamento e no código

1. **Não usar o arquivo diretamente como carga pronta.** Os importadores atuais leem primeira aba/cabeçalho no formato esperado. Aqui a primeira aba é Instruções e os cadastros começam na linha 4. É necessário mapear abas/colunas e conferir os dados. [Alunos](../../src/app/api/alunos/importar/route.ts), [turmas](../../src/app/api/turmas/importar/route.ts).
2. **Preservar IDs de origem.** O importador atual cria novos códigos; a migração deve manter correspondência com IDs de aluno, turma e movimento da planilha e permitir reexecução sem duplicação.
3. **Preservar vencimentos reais.** O [schema atual da matrícula](../../src/server/matricula/schema.ts) aceita apenas 5, 10, 15, 20 ou 25. Dos 49 dias informados na planilha, 39 ficam fora dessas opções. A implementação precisa acomodar as condições verificadas, inclusive o tratamento contratual de fim de mês; não deslocar vencimentos silenciosamente para caber na validação atual.
4. **A agenda precisa da fonte complementar.** Faltam país/fuso, níveis/metas e datas. Dias em espanhol e horários livres também exigem transformação compatível com as regras de F07.
5. **Histórico de turma não é novo contrato automaticamente.** A instrução da planilha usa uma nova linha de matrícula para registrar troca de turma. Na migração, distinguir contrato/matrícula duradoura de cada vínculo com turma; preservar as passagens sem duplicar contrato ou mensalidade.
6. **Há modelos comerciais além da mensalidade padrão.** Cobrança por hora, antecipações, pagamento por empresa e permuta precisam ser delimitados antes da carga financeira. Não são automaticamente reposições individuais de F07.6, nem comprovam entrega de contratos corporativos F20 ou venda avulsa de particulares.
7. **O mensal herda dados do cadastro atual.** Em geral, as colunas A:I de Mensalidades 2026 referenciam a mesma linha de Cadastro Alunos. Turma, professor e moeda exibidos não são uma fotografia de cada mês. H11, H12 e H101 são valores manuais, ao contrário da maioria das fórmulas dessa coluna. Conferir a vigência antes de reconstruir preço ou alocação históricos; não ordenar uma aba isoladamente supondo que os pagamentos manuais acompanharão o aluno.

Esses são requisitos de preparação e lacunas observadas. Não foram alterados importadores, regras de negócio ou dados do ERP nesta análise.

## 6. Pedido que pode ser encaminhado ao time

**Já temos a planilha operacional. Precisamos complementar e conferir os itens abaixo, aproveitando as fontes existentes. Podem enviar outras planilhas/documentos ou indicar onde encontrar a informação; não é necessário reescrever os dados já disponíveis.**

| Prioridade e responsável sugerido | O que pedir |
|---|---|
| 1 — Secretaria | País/fuso dos alunos; corrigir seis e-mails vazios e três com estrutura a revisar; conferir documentos/contatos compartilhados; relação de responsáveis legais/financeiros com nome, contato e aluno vinculado |
| 1 — Secretaria/Pedagógico | Datas reais de matrícula e de cada entrada/saída de turma, situação correta dos 25 inativos com vínculo histórico ativo e dos 17 sem histórico; esclarecer remanejamentos e a situação da turma 30 |
| 1 — Pedagógico | Para cada turma: idioma/nível, professor e grade confirmados, fuso, início, capacidade, meta de aulas e quantidade/registro de aulas já realizadas. Identificar turmas temporárias/rascunhos e calendário escolar |
| 1 — Secretaria/Comercial/Administração | Contratos/modelos e condições de cada matrícula: preço/moeda, vencimento, cobertura, descontos, taxa, continuidade, pausa e encerramento; evidência de aceite disponível. Identificar particulares por hora, antecipações, empresas pagadoras e permuta |
| 1 — Financeiro | Relação dos recebimentos: ID do aluno/matrícula, data efetiva, valor/moeda, meio, referência/comprovante, pagador e cobrança/período quitado. Completar os casos Pago sem valor/data e identificar o pagamento original das antecipações |
| 1 — Financeiro | Dias de vencimento faltantes, valor devido e cobertura por período, saldos abertos, créditos/devoluções e histórico anterior a julho quando necessário. Esclarecer os casos por hora e a linha 94 de Mensalidades 2026 |
| 2 — Pedagógico | Diários/chamadas, gravações no Drive com vínculo à aula, reposições, entregas/avaliações, particulares e cotas existentes |
| 2 — Administração | Cadastro da equipe e papéis; esclarecer nomes de professores e seus vínculos vigentes/históricos |
| 2 — Comercial/Atendimento | Leads, carteiras, negociações e preferências/autorização de comunicação por canal/finalidade, caso estejam em outra fonte |

Quando um dado não existir, informar a ausência para decidirmos o tratamento. A preparação não presume datas, contratos, pagamentos ou presenças. As prioridades indicam ordem de levantamento; não autorizam dispensar um dado necessário à operação ou aprovar a própria solicitação.

## 7. Verificação realizada

- Inspeção das sete abas e das observações, fórmulas, relações de IDs, preenchimento e tipos de dados. Não foram encontrados links externos de workbook, hyperlinks de célula ou URLs de gravações no conteúdo examinado.
- Contagens por intervalo, cruzamento aluno/turma/histórico e comparação independente das somas por moeda com o resumo salvo. Não se trata de conferência bancária nem autenticação de documentos/e-mails.
- Consulta do resumo e visualização por ferramenta de planilhas. O arquivo original não foi salvo ou sobrescrito; seu hash foi conferido antes e depois da análise, sem mudança.
- Identificação da cópia analisada: SHA-256 `87b9323a0de93cc23356325dfaf07a712ca6646cc40bc0283ff4d3ec01bf374c`.

O relatório usa contagens e referências de células, evitando reproduzir nomes, documentos e contatos dos alunos. Se a planilha for atualizada, os números de linha poderão mudar; manter a referência à cópia analisada e aos IDs de origem na conferência.
