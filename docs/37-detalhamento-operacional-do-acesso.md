# Detalhamento operacional do acesso — ERP Genius

**Status: especificação, em 07/09/2026. As decisões D01–D09 foram respondidas pelo usuário; os contratos técnicos abaixo traduzem essas decisões para implementação. Este documento não comprova que o código já as cumpre.**

> A descrição do código e as divergências abaixo são um retrato anterior à implementação. Consulte o [doc 38](38-implementacao-acesso-validacao.md) para o que foi implementado, resultados executados e limites atuais. As decisões operacionais adicionais de 08/09 estão nos docs 36/38; não devem ser inferidas dos trechos históricos deste inventário.

Complementa a [política aprovada](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/36-politica-de-acesso-aprovada.md). As falhas reproduzidas e os limites da execução permanecem na [auditoria profunda](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/34-auditoria-profunda-documentacao-vs-codigo.md). A leitura adicional considera o código da revisão `bc858af`; nesta etapa não foram alteradas funcionalidades da aplicação.

## 1. Decisões respondidas

| ID | Decisão aprovada | Consequência para o sistema |
|---|---|---|
| D01 | Secretaria informa o pagamento; Financeiro confirma | Comprovante fica **a conferir**. Informar não baixa a cobrança nem confirma recebimento. |
| D02 | Carteira individual com cobertura temporária | Acesso do vendedor depende de atribuição ou concessão vigente; gerente supervisiona sua equipe. |
| D03 | Direção/administrador substitui o gerente comercial ausente ou solicitante | A substituição não permite que a mesma pessoa solicite e aprove uma exceção. |
| D04 | Professor usa canal institucional; contato pessoal fica com a secretaria | A interface pedagógica não entrega telefone pessoal, e-mail pessoal ou link que revele esses dados. |
| D05 | Após a secretaria assumir a matrícula, vendedor solicita correção e secretaria executa | O acompanhamento comercial continua; edição de cadastro e documentos administrativos muda de responsável. |
| D06 | Limite de desconto separado para taxa de matrícula e mensalidade | Comparar cada componente com seu preço de referência, considerando os descontos acumulados. |
| D07 | Alçadas configuráveis; comissão por percentual **ou** valor fixo | Não fixar percentuais nesta especificação. A política de comissão precisa de tipo, valor/base, moeda e vigência. |
| D08 | Professor mantém histórico das próprias aulas em leitura | Encerrar o vínculo remove o acesso operacional atual, mas preserva o diário das aulas efetivamente ministradas. |
| D09 | Exportação depende de permissão específica da administração | A planilha contém somente registros e campos já autorizados; exportar não amplia acesso. |

D04 trata da relação entre professor e secretaria. Não revoga o acesso comercial ao contato da própria carteira nem o acesso do Financeiro ao responsável financeiro, já previstos na política, para suas respectivas atividades.

## 2. Referências utilizadas no detalhamento

- A OWASP recomenda negar por padrão e verificar autorização em cada requisição, incluindo arquivos. A aplicação à escola é conferir ação, vínculo, campos e condições no servidor, inclusive em consultas e downloads. [OWASP — Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- A OWASP recomenda vincular a autorização aos dados da transação e revalidá-la na execução. Nossa aplicação é fazer a aprovação corresponder à versão exata do desconto ou pagamento; mudança relevante exige nova conferência. [OWASP — Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html).
- O Dynamics 365 permite delegar itens de workflow por escopo e intervalo de datas. Para a escola, a cobertura terá destinatário, escopo, capacidades, início e fim explícitos. Essa configuração concreta é uma decisão nossa, não uma descrição de clientes da Microsoft. [Microsoft — delegação de workflow](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/fin-ops/organization-administration/tasks/delegate-work-items-workflow).

As referências de ERP, CRM e sistemas educacionais estão no [doc 35](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/35-referencias-de-mercado-escopos-e-permissoes.md). Elas fundamentam o desenho; não certificam a implementação do ERP Genius.

## 3. Vocabulário de escopos e composição de papéis

| Escopo | Vínculo necessário | Limite |
|---|---|---|
| Carteira própria | Proprietário comercial atual ou cobertura expressa vigente | Não inclui toda a carteira por possuir o papel VENDEDOR. |
| Equipe comercial | Associação explícita entre gerente, equipe e vendedores | Ter GERENTE_COMERCIAL não significa supervisionar todas as equipes futuras. |
| Experimental atribuída | Professor responsável pela ocorrência | Dá contexto pedagógico da experimental, sem ficha comercial integral. |
| Turma atual | Atribuição docente vigente e aluno vinculado à turma | Não inclui dados financeiros ou contato pessoal. |
| Histórico docente | Autoria e período das aulas ministradas | Somente leitura dos próprios registros; não abre a ficha atual do aluno. |
| Operação da secretaria | Atendimento cadastral, contratual e acadêmico da escola | Consulta financeira individual não abre caixa, despesas ou comissões. |
| Operação financeira | Cobrança, matrícula e pagador vinculados ao atendimento | Não entrega automaticamente informações pedagógicas ou todos os responsáveis. |
| Atendimento institucional | Fila, responsável, participantes e finalidade do atendimento | Um número de WhatsApp ou um contato compartilhado não autoriza todo o histórico. |
| Comissão própria | Beneficiário registrado na comissão | Troca de dono do lead não transfere a comissão histórica nem abre a de colegas. |

Começar com uma escola e uma equipe explicitamente cadastradas é suficiente. Ausência de vínculo não deve virar escopo global. Futuras unidades presenciais podem acrescentar um limite organizacional a esses vínculos; sala ou modalidade presencial não é um novo papel.

As concessões devem ser avaliadas completas. Exemplo: alguém com VENDEDOR e PROFESSOR pode consultar os dados comerciais dos seus leads e os dados pedagógicos dos seus alunos. O conjunto de todos os seus alunos não passa a ter a projeção financeira do vendedor. Uma restrição de autoaprovação continua válida mesmo para quem também é administrador.

## 4. Mapa de capacidades para o código atual

O inventário textual encontrou **73 funções assíncronas exportadas em `acoes.ts`, 55 funções exportadas em `consultas.ts` e 12 arquivos de rota em `src/app/api`**. As 55 incluem auxiliares; esses números não representam 140 endpoints públicos nem cobertura de testes. A tabela agrupa operações que precisam compartilhar o mesmo contrato de autorização.

Os identificadores de capacidades abaixo são **nomes propostos**, ainda não cadastrados no sistema. ADM = administração/direção autorizada; GC = gerente comercial; VEN = vendedor; GP = gerente pedagógico; PRO = professor; SEC = secretaria; FIN = financeiro. As condições e campos das demais seções continuam obrigatórios em cada linha; ADM não dispensa aprovação independente.

### Comercial e matrícula

Referências: [ações comerciais](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/acoes.ts), [consultas comerciais](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/consultas.ts), [ações de matrícula](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/acoes.ts).

| Capacidade proposta | Funções ou fluxo | Autorização pretendida |
|---|---|---|
| `crm.ler` | `listarLeads`, `obterLead`, `obterLeadParaMatricula` | VEN na carteira; GC na equipe; ADM. Experimental usa outra projeção. |
| `crm.criar` | `criarLead` | VEN para sua carteira; GC para integrante da equipe; ADM. Validar o dono recebido no formulário. |
| `crm.editar` | `editarLead`, `definirTemperatura`, `atualizarResumo`, `atualizarDatas` | Carteira/equipe; respeitar D05 e separar campos comerciais de cadastro. |
| `crm.registrar_interacao` | `registrarNotaInterna`, `registrarInteracao` | Carteira/equipe; classificar finalidade antes de compartilhar com outra área. |
| `crm.mover_etapa` | `moverEtapa`, `marcarPerdido` | Carteira/equipe e transição válida; não substitui ativação de matrícula. |
| `crm.atribuir` | `atribuirDono` | GC na sua equipe ou ADM; recalcular atendimento, acesso e tarefas pendentes. |
| `crm.cobrir` | Concessão temporária, ainda sem fluxo próprio | GC/ADM concede alcance e período; não altera o beneficiário da comissão. |
| `experimental.agendar` | `agendarExperimental`, `atribuirProfessorExperimental` | Comercial no lead autorizado; atribuição dentro da oferta/agenda acadêmica permitida. |
| `experimental.registrar_resultado` | `checkinExperimental` e futuro parecer | PRO na ocorrência atribuída; GP para correção justificada. Check-in comercial, quando necessário, deve ser capacidade própria e não habilitar parecer pedagógico. |
| `proposta.enviar` | `enviarProposta` | Carteira/equipe; preços e descontos autorizados e versão aprovada. |
| `documento.anexar`, `documento.arquivar` | `anexarDocumentoLead`, `arquivarDocumentoLead` | Validar categoria, objeto e finalidade; documento administrativo após assunção segue D05. |
| `matricula.criar` | `criarMatricula` | VEN/GC no escopo comercial; criação não confirma pagamento. O acesso da SEC para executar a matrícula deve ser expresso no fluxo de assunção. |
| `matricula.assumir` | Novo registro de responsabilidade da secretaria | SEC/ADM; responsável e instante explícitos, sem deduzir de uma tela visitada. |
| `matricula.ativar` | `ativarMatricula`, `criarEAtivarMatricula` | SEC/FIN/ADM no escopo e com pré-condições de negócio satisfeitas. Informar comprovante não satisfaz recebimento confirmado. O fluxo combinado precisa de todas as capacidades envolvidas. |
| `cadastro.solicitar_correcao` | Novo fluxo após D05 | VEN abre solicitação no vínculo comercial; acompanha resolução sem editar cadastro protegido. |

### Financeiro e cobrança

Referências: [ações financeiras](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/financeiro/acoes.ts), [ajustes](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/ajustes/acoes.ts), [cobranças](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/cobrancas/acoes.ts).

| Capacidade proposta | Funções ou fluxo | Autorização pretendida |
|---|---|---|
| `pagamento.informar` | Nova etapa anterior à baixa atual | SEC no atendimento; valor, data e comprovante ficam a conferir. |
| `pagamento.confirmar`, `pagamento.rejeitar` | Separar o comportamento de `registrarPagamento` | FIN/ADM autorizado; conferência independente do informe da SEC e controle contra duplicidade. Caixa exige concessão específica; não transforma uma autoaprovação em conferência independente. |
| `financeiro.ler_atendimento` | `obterFichaFinanceira`, histórico individual | SEC/FIN/ADM; SEC sem comissões e consolidação de caixa. |
| `financeiro.ler_comercial` | Projeção comercial de matrícula e relatórios | VEN: sua negociação, confirmação inicial e sua comissão; GC: resultados da equipe. |
| `financeiro.ler_gestao` | `kpisFinanceiro`, `listarComissoes`, `relatorioDescontosComissoes` | FIN/ADM; separar relatório comercial para GC e extrato de comissão para VEN. |
| `desconto.aplicar`, `desconto.solicitar` | `ajustarCobranca` e preços na criação da matrícula | VEN/GC/FIN/ADM conforme concessão, objeto e alçada; nenhuma entrada pode ignorar D06. |
| `desconto.aprovar` | `decidirAprovacao` quando o tipo for desconto | GC autorizado na equipe; direção/ADM no caso D03 ou acima da alçada do GC; solicitante diferente. |
| `financeiro.aprovar_excecao` | Tipos bolsa, perdão, estorno e outras exceções | Capacidades por tipo e alçada. Aprovar desconto não autoriza automaticamente perdão, estorno ou mudança de comissão. |
| `comissao.configurar` | Nova política de comissão | Direção/ADM; GC/FIN somente por delegação expressa. VEN consulta a regra aplicável. |
| `comissao.pagar` | `fecharMesComissoes` | FIN/ADM autorizado; lote e lançamentos elegíveis, sem alterar política, beneficiário ou valores já pagos silenciosamente. |
| `cambio.manter` | `salvarTaxasCambio`, `atualizarCotacoesAutomatico` | FIN/ADM delegado; taxa consultável não implica manutenção liberada. |
| `cobranca.atender` | `registrarPromessaPagamento`, `registrarCobrancaWhatsApp` | FIN ou SEC com capacidade específica de atendimento; cobrança e destinatário pertinentes. Registro de contato não libera disparo irrestrito. |
| `acesso_aula.restringir`, `acesso_aula.liberar` | `bloquearAcesso`, `desbloquearAcesso` | **Regra de negócio a definir separadamente.** As funções existentes não demonstram aprovação de uma política de suspensão por dívida. |

### Acadêmico, cadastro e configurações

Referências: [alunos](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/alunos/acoes.ts), [turmas](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/turmas/acoes.ts), [catálogo](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/catalogo/acoes.ts), [países](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/paises/acoes.ts), [usuários](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/acesso/acoes.ts).

| Capacidade proposta | Funções ou fluxo | Autorização pretendida |
|---|---|---|
| `aluno.ler` | `listarAlunos`, `obterAluno`, `obterTurma` | Projeções e vínculos próprios para PRO, GP, SEC e FIN; ADM amplo. Sem usuário não deve significar acesso global. |
| `cadastro.editar` | `editarAluno` | SEC/ADM nos campos administrativos; cadastro acadêmico deve ter projeção de edição própria. GP/PRO não ganham edição documental pelo papel pedagógico. |
| `aluno.movimentar` | `pausarAluno`, `reativarAluno`, `encerrarAluno` | SEC/GP/ADM nas operações autorizadas; efeitos contratuais/financeiros dependem das regras desse domínio. |
| `turma.transferir_equivalente` | `trocarTurma` | SEC/GP/ADM; mesma língua e nível, vaga e agenda compatíveis. |
| `academico.aprovar_excecao` | Pedido de mudança de nível; implementação D14 no [doc 40](40-mudancas-academicas-com-aprovacao.md) | GP/direção decide independentemente; PRO emite parecer; SEC executa a decisão vigente. D14 prevê dispensa justificada de parecer indisponível; outras exceções curriculares não são automaticamente implementadas por esse fluxo. |
| `turma.solicitar_abertura` | `solicitarAberturaTurma` | Comercial encaminha demanda; solicitação não publica turma. |
| `turma.manter` | `criarTurma`, `editarTurma`, `alterarStatusTurma` | GP/SEC conforme atribuição; mudança curricular ou efeito contratual exige a capacidade correspondente. |
| `curriculo.manter` | `criarIdioma`, `alternarIdiomaAtivo`, `criarNivel` | GP/ADM; respeitar vínculos e histórico em uso. |
| `oferta.manter` | `criarModalidade`, `editarModalidade`, `criarProduto` | Separar componente pedagógico de preço/condição comercial; concessão explícita por domínio. |
| `preco.manter` | `criarPreco`, `alternarPrecoAtivo` | Direção/ADM ou delegação comercial/financeira; versionar vigência. |
| `mercado.manter` | `criarPais`, `editarPais`, `alterarStatusPais`, `alternarProdutoPais` | Direção/ADM; preservar identidades e contratos existentes. |
| `catalogo.consultar` | Consultas de país, idioma, produto, preço e disponibilidade | Equipes recebem opções publicadas necessárias à sua tarefa; não toda configuração interna. |
| `comercial.configurar` | `salvarConfigComercial`, `salvarReguaComercial` e consultas de configuração/ensaio | GC/ADM no escopo; separar parâmetros de atendimento de segurança, comissões e ativação de automação. |
| `acesso.administrar` | `criarUsuario`, `editarUsuario`, `alternarUsuarioAtivo`, `listarUsuarios` | ADM autorizado; diretórios operacionais de professores/vendedores recebem resposta mínima, não cadastro administrativo integral. |

### WhatsApp, arquivos e rotas

Referências: [ações WhatsApp](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/acoes.ts), [consultas WhatsApp](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/consultas.ts), [escopo atual](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/escopo.ts).

| Capacidade proposta | Funções ou fluxo | Autorização pretendida |
|---|---|---|
| `whatsapp.ler` | `listarConversas`, `carregarThread`, `contarNaoLidas`, `conversaVisivel` | Participação e finalidade do atendimento, inclusive contadores e mídias. |
| `whatsapp.enviar` | `enviarTextoInbox`, `enviarMidiaInbox` | Atendimento autorizado, destinatário válido e condições atuais; PRO usa contexto pedagógico institucional, ainda inexistente na inbox atual. |
| `whatsapp.organizar_atendimento` | `marcarConversaLida`, `marcarConversaTratada` | Mesma autorização do atendimento; leitura não autoriza encerramento indiscriminado. |
| `whatsapp.vincular` | `buscarVinculosInbox`, `buscarPessoasVinculo`, `vincularContatoWhatsApp` | Validar acesso ao atendimento e à pessoa de destino; busca não revela outra carteira/finalidade. |
| `cobranca.enviar`, `cobranca.aprovar_lote` | `enfileirarCobrancaWhatsApp`, `aprovarLoteCobranca` | Capacidade financeira correspondente; cada item e destinatário precisam continuar elegíveis no envio. |
| `comunicacao.registrar_recusa`, `comunicacao.reautorizar` | `registrarOptOutContato`, `removerOptOutContato` | Atendente no contato autorizado registra recusa; remover exige evidência de nova autorização e capacidade própria. |
| `canal.configurar` | `salvarNumeroWhatsApp`, `conectarNumeroQr`, `consultarSessaoNumero` | ADM técnico autorizado. Equipes consultam disponibilidade do canal sem credenciais/QR de vinculação. |
| `template.manter`, `template.publicar` | `salvarTemplateWhatsApp`, `submeterTemplateMeta`, `sincronizarTemplatesMeta` | Gestão da área mantém conteúdo autorizado; publicação/sincronização técnica com capacidade expressa. |
| `automacao.configurar`, `automacao.ativar`, `automacao.parar` | `salvarPoliticaRegua`, `acionarKillSwitchRegua` | Gestão financeira/comercial conforme a régua; interromper emergencialmente e reativar são autorizações distintas. |
| `arquivo.enviar`, `arquivo.ler` | `/api/upload`, `/api/whatsapp/upload`, `/api/files/[...path]` | Usuário ativo, objeto, categoria, finalidade e capacidade atuais; caminho conhecido não é autorização. |
| `dados.importar` | `/api/alunos/importar`, `/api/turmas/importar` | Capacidade específica mais autorização das criações/alterações de cada linha. Importação não concede permissões de configuração ou exceção. |
| `dados.exportar` | Futuras exportações de alunos/leads | Concessão administrativa explícita, limitada por conjunto de dados, registros e campos de D09. |

As rotas `/api/alunos/modelo` e `/api/turmas/modelo` fornecem modelos de importação; não devem ser descritas como exportação de dados pessoais já implementada. `/api/auth/[...nextauth]` trata autenticação, sem substituir autorização de negócio. Os webhooks Meta/Evolution, `/api/whatsapp/cron` e `/api/whatsapp/health` exigem seus contratos de integração: identidade do provedor/serviço, finalidade e conteúdo mínimo. Não devem reutilizar uma suposta sessão humana global para operar.

Home, busca, filtros, diretórios, ensaios de automação, contadores e relatórios precisam passar pelo mesmo escopo. `dadosHomeVendedor`, `dadosHomeProfessor` e `dadosHomeGerente` também fazem parte dessa revisão. O filtro opcional enviado pelo cliente sempre restringe o filtro obrigatório; nunca o substitui.

## 5. Projeções de campos

Os nomes abaixo vêm do [schema atual](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/prisma/schema.prisma). A projeção é um contrato de resposta criado no servidor. Não basta remover um campo visualmente ou devolver o objeto inteiro com algumas propriedades ocultadas.

| Dados existentes ou derivados | Leitura pretendida | Escrita e restrições |
|---|---|---|
| Aluno: `id`, `codigo`, `primeiroNome`, `sobrenome`, `nomePreferido` | Equipes com vínculo autorizado | SEC mantém cadastro; ajustes após D05 via solicitação comercial. |
| `nascimento` | SEC para cadastro; pedagógico recebe faixa etária necessária | Data completa não é campo padrão do professor; derivação de faixa etária ainda precisa ser implementada. |
| `genero`, `escolaridade`, `idiomaNativo` | Apenas finalidade cadastral/pedagógica pertinente | Não publicar todo o cadastro por esses campos serem úteis ao planejamento. |
| `documento`, `tipoDocumentoId`, `documentoValido`, `documentoPaisEmissor`, nacionalidades | SEC; FIN somente quando necessário ao contrato/cobrança; coleta comercial inicial autorizada | PRO não recebe; após assunção, VEN acompanha pendência documental sem receber automaticamente número ou arquivo. |
| `email`, `telefoneE164`, `whatsapp`, `aceitaComunicacoes` | SEC; comercial na carteira; FIN para contato financeiro pertinente | PRO usa identificador institucional de destinatário. Editar preferência exige ação própria e evidência pertinente. |
| `paisResidencia`, `cep`, `rua`, `numero`, `complemento`, `bairro`, `cidade`, `regiao` | SEC; FIN para necessidade contratual específica | Professor não recebe endereço residencial. |
| `fuso`, idioma, nível, turma, horário e link institucional da aula | Participantes e equipes operacionais autorizadas | Comercial consulta disponibilidade sem obter lista integral de alunos de cada turma. |
| `Responsavel.nome`, `parentesco`, `telefoneE164`, `email`; `AlunoResponsavel.papel` | SEC; FIN para vínculo FINANCEIRO; pedagógico no vínculo apropriado via canal institucional | Um responsável de emergência não se torna contato de cobrança. Acesso a um filho não abre os demais vínculos do responsável. |
| `Aluno.status`, situação operacional da matrícula/alocação | PRO/GP recebem estado acadêmico necessário | Não incluir dívida, atraso ou motivo financeiro na mensagem operacional. |
| `Aluno.observacoes`, `MovimentacaoAluno.motivo/observacao` | Separar anotações por finalidade antes de compartilhar | Texto livre pode conter dívida ou documento; conteúdo legado sem classificação não entra automaticamente na projeção pedagógica. |
| Lead: origem, temperatura, etapa, orçamento, objeções, `valorPrevisto`, `comissaoPrevista`, follow-up | VEN da carteira e GC da equipe; ADM | PRO recebe objetivo pedagógico preparado para a experimental, não o resumo comercial bruto. |
| Experimental: atribuição, data, confirmação, presença e parecer | PRO atribuído e GP; comercial recebe resultado operacional necessário | Parecer pedagógico e check-in têm autores e capacidades distintos. |
| Matrícula: produto, modalidade, vigência, turma | Acadêmico e administrativo conforme vínculo | Taxa, mensalidade e condições contratuais seguem projeção comercial/financeira, não pedagógica. |
| Cobrança: `valorOriginal`, `valorNegociado`, `valorRecebido`, `saldo`, `moeda`, `vencimento`, `status`, `pagoEm` | SEC no atendimento individual; FIN/ADM; VEN somente negociação e confirmação inicial permitidas | Registro de comprovante é separado da escrita de saldo/baixa. PRO/GP não recebem extrato financeiro. |
| Comissão: beneficiário, tipo da regra, percentual/valor, moeda, situação, pagamento | Beneficiário consulta a própria; GC consulta equipe; FIN/ADM autorizado | VEN não fornece percentual efetivo ao servidor nem troca beneficiário para ganhar acesso. |
| Preço de referência, versão de política, alçada aplicável | Comercial/FIN consultam os parâmetros necessários à operação | Servidor escolhe regra e calcula; cliente não decide a referência. PRO consulta oferta acadêmica sem preços. |
| Documento: `categoria`, `nome`, `url`, `arquivado` | PRO: teste de nível pertinente; demais categorias conforme finalidade e etapa | PRO não recebe PROPOSTA/CONTRATO/COMPROVANTE. OUTRO exige classificação. Nome e URL também podem revelar dados. |
| WhatsApp: mensagens, anexos, autor, destinatário, timestamps e referências | Somente atendimento e contexto autorizados | PRO não recebe telefone em metadados, URLs de mídia ou atalhos. Conteúdo livre escrito por participantes pode conter telefone; a política não promete anonimização automática do texto. |
| Usuário: identificação operacional versus papéis, alçadas e dados administrativos | Diretório mínimo para atribuir professor/vendedor; gestão completa só para administradores autorizados | Senha, hash, token e segredo não são campos de consulta de equipe. |
| Eventos e payloads JSON | Projeção por evento/finalidade | Não entregar a linha do tempo bruta para todas as funções; preservar trilha de auditoria com acesso próprio. |

Campos não enumerados numa projeção não entram por herança de um objeto Prisma. Listas, detalhes, mensagens de erro, notificações, arquivos e exportações seguem a mesma regra. Uma referência de arquivo vinculada a mais de um objeto não deve permitir que uma associação menos restrita exponha documento de outra finalidade.

## 6. Fluxos operacionais

### 6.1 Pagamento informado e conferido — D01

Proposta técnica: registro próprio `PagamentoInformado` com cobrança, valor, moeda, data alegada, comprovante, autor, versão e estado `A_CONFERIR`, `CONFIRMADO` ou `REJEITADO`. Esses nomes e estados ainda não existem como fluxo completo no código.

1. SEC registra o informe e o comprovante. O sistema não altera `valorRecebido`, saldo ou situação de quitação; não ativa matrícula por esse registro.
2. FIN consulta o informe e a cobrança correspondente e confirma ou rejeita com justificativa pertinente. Neste fluxo, a conferência é independente do autor do informe; acumular SEC e FIN não representa duas pessoas.
3. Na confirmação, conferir novamente versão, moeda, valor, cobrança elegível e eventual duplicidade. Criar o recebimento e atualizar cobrança e trilha na mesma transação; repetição da mesma confirmação não recebe duas vezes.
4. Alterar valor, cobrança ou comprovante depois de submetido exige nova versão/conferência. Rejeitar preserva a evidência; pagamento efetivamente confirmado é corrigido por ajuste/estorno autorizado, não pela exclusão do informe.

Cada recebimento parcial precisa de identidade própria e histórico preservado. Apenas guardar o último comprovante na cobrança não modela esse fluxo. A capacidade de caixa aprovada no doc 36 pode autorizar uma operação própria de recebimento; ela não dispensa a segunda pessoa quando a operação exige conferência independente.

**Divergência atual:** [registrarPagamento](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/financeiro/acoes.ts:33) aceita SEC/FIN e já altera o acumulado e a quitação. A [ativação](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/acoes.ts:388) possui outro caminho financeiro. Ambos precisam obedecer ao mesmo contrato para D01 ser entregue. Prazo de conferência e efeito de um informe pendente sobre a régua são parâmetros/regras ainda não escolhidos; não presumir suspensão automática de cobrança.

### 6.2 Assunção da matrícula e correções — D05

Registrar explicitamente quem assumiu a matrícula e quando. Antes disso, o comercial pode coletar os dados iniciais permitidos; depois, altera apenas o contexto comercial autorizado e abre solicitações de correção cadastral/documental para SEC. A solicitação identifica objeto, campo, motivo e evidência permitida, com autor e resolução registrados.

Essa transição não transfere silenciosamente a propriedade comercial nem a comissão. O vendedor acompanha conclusão, pendências e confirmação inicial de pagamento pela projeção comercial. Não ganha acesso permanente a documentos pessoais apenas por ter originado a venda. O schema atual não possui uma etapa explícita de assunção que garanta essa regra.

### 6.3 Descontos e alçadas configuráveis — D06/D07

Manter limites separados para taxa e mensalidade, associados à função/concessão aplicável e com vigência. Os valores serão cadastrados pela administração; esta especificação não escolhe percentuais. Configuração ausente significa ausência de autonomia para conceder desconto, não desconto ilimitado.

Congelar o preço de referência e sua versão na negociação. Para cada componente, calcular o desconto acumulado em relação a essa referência. Exemplo meramente matemático: referência 100, negociação anterior 95, novo valor 90 corresponde a **10% de desconto acumulado**, não apenas ao desconto da última alteração. Gratuidade de taxa não pode ser diluída no total das mensalidades para parecer dentro da alçada.

Aplicar a mesma validação na proposta, matrícula, ajuste e operação combinada, inclusive alterando parcelas futuras. Mudança de preço de catálogo não deve substituir silenciosamente a referência de uma negociação existente. Desconto, bolsa e promoção acumuláveis precisam de regra explícita para evitar dupla aplicação; preços de referência nulos/zero não podem produzir divisão inválida ou autorização implícita.

A aprovação deve registrar solicitante, aprovador, objeto, valores anterior/proposto, referência, componentes afetados, vigência, motivo e versão. Ela vale para aquela operação. Ao executá-la, conferir as condições atuais e invalidar pedido cujos dados relevantes mudaram. D03 encaminha a direção/ADM autorizado quando o gerente for solicitante ou estiver ausente.

### 6.4 Comissão configurável por percentual ou valor fixo — D07

| Parâmetro | Contrato proposto |
|---|---|
| Tipo | `PERCENTUAL` ou `VALOR_FIXO`; uma regra escolhe um tipo, sem somar os dois implicitamente. |
| Percentual | Percentual configurado e base de cálculo identificada. A regra existente documentada usa a taxa de matrícula; não presumir comissão sobre todas as mensalidades. |
| Valor fixo | Quantia e moeda explícitas por comissão de matrícula, conforme o gatilho de elegibilidade do domínio. Não é valor por parcela ou pagamento recorrente por decorrência do tipo. |
| Aplicação | Beneficiário/função e oferta/mercado pertinentes; resolver qual regra se aplica sem sobreposição ambígua. Não exigir uma estrutura empresarial complexa para a primeira escola. |
| Vigência | Início, término quando houver, versão, autor e publicação. Configuração nova vale para novas negociações elegíveis; não reescreve as já registradas. |
| Memória do cálculo | Regra/versão, beneficiário, tipo, base, percentual ou valor fixo, moeda, resultado e momento de aplicação registrados na negociação/comissão. |
| Exceção | Pedido específico com motivo e aprovação independente quando exigida; alterar configuração não serve para aprovar o próprio pedido. |

O servidor resolve a regra. O vendedor não envia um percentual arbitrário para se tornar a fonte do cálculo. Na regra percentual, alteração autorizada da base pode exigir recálculo conforme o estado da comissão; na regra fixa, desconto na taxa não reduz o valor fixo automaticamente. Se a escola quiser esse vínculo, será uma regra adicional explícita.

Para moedas diferentes, exigir política compatível ou regra explícita de conversão, com taxa e data registradas. Não tratar o mesmo número como valor fixo equivalente em todas as moedas. Usar cálculo monetário decimal e arredondamento consistente com a moeda.

Mudança de política preserva os registros anteriores. Ajustes autorizados em comissões já pagas geram lançamentos vinculados e auditáveis; não substituem o valor pago no registro original. Prazo de aquisição, pagamento, cancelamento e estorno da comissão continuam sendo regras financeiras próprias; escolher percentual/valor fixo não as redefine.

**Divergências atuais:** o [schema de entrada](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/schema.ts:91) aceita `comissaoPct` e um padrão numérico; a [criação](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/acoes.ts:327) usa esse valor. O [modelo Comissao](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/prisma/schema.prisma:657) exige percentual e não guarda política versionada de valor fixo. O [ajuste da taxa](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/ajustes/acoes.ts:137) recalcula as comissões relacionadas sem separar as já pagas nesse trecho. Essas são leituras do código, não uma nova validação em execução.

### 6.5 Cobertura e transferência — D02/D03

Registrar concedente, substituto, carteira/objetos, capacidades, motivo, início, fim e revogação. A cobertura comercial não concede automaticamente exportação, redistribuição de carteira, aprovação, administração ou transferência de comissão. Delegação de aprovação é uma concessão distinta e continua sujeita à alçada e à separação entre solicitante e aprovador.

Fim do prazo ou revogação deve valer no próximo acesso, download e operação. Para envio humano agendado, conferir novamente autorização do autor e contexto no momento de executar. Troca de responsável exige decidir explicitamente se a intenção pendente será cancelada ou reatribuída; preservar o autor original. Automações institucionais usam identidade e política próprias, com destinatário e finalidade novamente validados, sem herdar poderes globais de quem as cadastrou.

### 6.6 Atendimento institucional e histórico — D04/D08

Separar canal de transporte, contato e atendimento. A conversa atual é única por número/contato e sua [autorização acompanha o número](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/escopo.ts). Adicionar somente um novo dono a essa conversa não resolve o caso de histórico misto comercial, financeiro e pedagógico.

Exceção aprovada em 26/09/2026 — números de finalidade VENDAS são **linhas comerciais** ([SPEC-ERP-005](specs/whatsapp-linha-comercial.md)): o dono atual da linha, o gerente comercial da equipe dele e a administração veem todas as conversas da linha, com ou sem lead. A exceção cobre só o conteúdo da conversa; ficha de aluno, financeiro, matrícula e painel de lead de outra carteira continuam nas regras desta seção. Canais institucionais (COBRANCA, AGENDA) não mudam.

Modelar contexto de atendimento com finalidade, fila, responsável, participantes e associação das mensagens/anexos ao contexto. O sucessor recebe o histórico necessário à continuidade na mesma finalidade. Conteúdo financeiro anterior não passa para professor ou vendedor só porque é do mesmo aluno. Histórico legado sem classificação exige migração/revisão ou restrição, não compartilhamento integral por padrão.

Professor envia pelo canal institucional para destinatário vinculado à sua turma/experimental, com identificador interno. D04 não autoriza conceder ao professor toda a inbox da secretaria. Mensagem e anexo também precisam respeitar o contexto; não basta esconder a coluna telefone.

Ao deixar a turma, PRO mantém apenas o registro das aulas que ministrou, em leitura, sem acesso ao contato, à ficha atual ou a mensagens novas. Isso exige vínculo docente temporal e diário com autoria/período. O atual `Turma.professorId` e a alocação ativa do aluno, isoladamente, não fornecem esse histórico. Não existe entrega do diário completo apenas por haver dados de turma e experimental.

### 6.7 Exportação — D09

A administração concede exportação para um conjunto de dados e escopo definidos. O servidor reaproveita as mesmas projeções e vínculos autorizados na tela. Filtro, seleção de coluna ou ID enviado pelo cliente não pode acrescentar dados. Exportação em lote precisa de autorização no pedido, na geração e no download, com registro do autor, finalidade operacional, filtros, quantidade, colunas e instante; não copiar o conteúdo pessoal completo para o log.

A permissão de exportação não autoriza importação. Após revogação, o ERP bloqueia novos downloads protegidos, mas não consegue apagar uma planilha que a pessoa já salvou fora dele.

## 7. Contrato técnico comum

Para cada operação, a implementação deve resolver, nesta ordem lógica:

1. Identidade e estado atuais do usuário ou serviço, capacidades e concessões vigentes.
2. Objeto e vínculos autorizados para a capacidade, combinados com filtros de busca que apenas restringem o resultado.
3. Campos de entrada permitidos e projeção de saída da finalidade; rejeitar alteração de campo protegido, mesmo por requisição direta.
4. Estado do objeto, versão, alçada e aprovação necessárias; revalidar na transação ou execução posterior para impedir que uma mudança concorrente invalide a decisão.
5. Persistência coerente, resposta mínima e trilha com autor, objeto, capacidade, versão, decisão e motivo. A trilha não deve se tornar uma cópia irrestrita de documentos, credenciais e conversas.

O [helper de sessão](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/_shared/sessao.ts) já relê usuário ativo e papéis atuais do banco. Isso é uma base aproveitável; não comprova que todas as rotas o utilizam. Seu atalho de administrador pode satisfazer o papel, mas não deve dispensar as demais condições, especialmente separação de pessoas e validade da operação.

As consultas reutilizáveis não podem ter ausência de usuário interpretada como acesso global. Se uma rotina interna precisar de acesso de serviço, deve declarar essa identidade e finalidade. O payload bruto Prisma/Evento não é um contrato seguro de projeção.

## 8. Critérios verificáveis de aceite

**Cenários a implementar/executar. Esta tabela não apresenta resultados de testes já aprovados.** Cada grupo precisa cobrir chamada direta ao servidor e o caminho de interface correspondente; testes de arquivos/exportações devem inspecionar o conteúdo efetivamente devolvido.

| ID | Cenário | Resultado exigido |
|---|---|---|
| AC01 | VEN consulta próprio lead e depois lead alheio por ID ou filtro | Próprio retorna projeção comercial; alheio é negado. Filtro não substitui carteira. |
| AC02 | GC consulta equipe atribuída e outra equipe | Somente a equipe autorizada é incluída, inclusive em totais e relatórios. |
| AC03 | Usuário VEN+PRO consulta aluno de sua turma sem vínculo comercial | Recebe projeção pedagógica; não aproveita escopo docente para obter finanças de vendedor. |
| AC04 | PRO abre ficha, busca, experimental e arquivo de aluno autorizado | Recebe apenas campos/contexto pedagógico; sem documento pessoal, financeiro, contato pessoal ou eventos brutos. |
| AC05 | PRO perde turma e consulta diário antigo e ficha atual | Próprias aulas permanecem em leitura; acesso operacional atual e edição são negados. |
| AC06 | Usuário é desativado ou perde papel após login | Próximas ações, consultas, uploads e downloads protegidos são negados. Regressão inclui H04/H05 da auditoria. |
| AC07 | Cobertura começa, termina ou é revogada | Acesso só existe no intervalo; comissão histórica e poder de exportar/aprovar não são concedidos por decorrência da cobertura. |
| AC08 | Lead/atendimento muda de dono | Sucessor recebe histórico autorizado; anterior perde acesso operacional sem concessão vigente; autoria e comissão ficam preservadas. |
| AC09 | Mesmo contato tem atendimentos financeiro e pedagógico | PRO não obtém conteúdo financeiro por lista, busca, mídia ou histórico misto. |
| AC10 | SEC registra comprovante | Informe fica a conferir; saldo, baixa e ativação não são alterados pelo informe. |
| AC11 | FIN diferente confirma informe válido; rejeita outro | Confirmação gera um recebimento; rejeição não movimenta saldo e preserva evidência. |
| AC12 | Autor SEC+FIN tenta confirmar seu próprio informe | Fluxo de conferência independente nega; acúmulo de papéis não simula outra pessoa. |
| AC13 | Duas confirmações simultâneas ou repetidas do mesmo informe | Exatamente um recebimento efetivo; saldo reflete o acumulado correto. O risco concorrente F03 continua a exigir execução apropriada, não foi confirmado pela auditoria anterior. |
| AC14 | Valor, cobrança ou comprovante muda após submissão/aprovação | Não é possível executar usando a conferência da versão anterior. |
| AC15 | VEN altera cadastro/documento após assunção da SEC | Alteração direta é negada; solicitação de correção funciona e preserva autoria/resolução. |
| AC16 | Desconto dentro e acima da alçada, por criação e por ajuste | Todos os caminhos usam a mesma referência; acima do limite exige aprovador autorizado. |
| AC17 | Taxa fora da alçada e mensalidade dentro; depois o inverso | Cada componente é verificado separadamente, sem compensação pelo valor total do contrato. |
| AC18 | Duas reduções sucessivas ou promoção acumulada | Verifica desconto total contra referência original da negociação, conforme regra de acumulação. |
| AC19 | GC é solicitante, está ausente ou acumula ADM | Roteamento D03 para outra pessoa autorizada; nenhum papel permite autoaprovação independente. |
| AC20 | Usuário altera sua alçada/configuração para aprovar pedido aberto | Não contorna a exigência de aprovação nem altera silenciosamente a versão do pedido. |
| AC21 | Configuração de comissão percentual e configuração de valor fixo | Percentual usa base definida; fixo usa quantia/moeda definidas; formulário do VEN não pode sobrescrever a regra. |
| AC22 | Nova regra de comissão entra em vigor | Nova negociação elegível usa nova versão; registros anteriores mantêm memória do cálculo. |
| AC23 | Desconto altera taxa de uma comissão fixa ou de comissão já paga | Não aplica fórmula percentual ao fixo; não sobrescreve valor pago. Ajuste autorizado fica vinculado e rastreável. |
| AC24 | Regra ausente, sobreposta ou incompatível com moeda | Não usa percentual padrão do formulário, regra arbitrária ou valor fixo em moeda errada; exige configuração válida. |
| AC25 | SEC transfere aluno para turma equivalente e depois tenta salto de nível | Equivalente funciona com condições; salto exige decisão pedagógica válida antes da execução. |
| AC26 | Equipe consulta preço/idioma disponível e tenta editar configuração | Consulta das opções necessárias funciona; manutenção exige capacidade de seu domínio. |
| AC27 | Usuário sem exportação pede planilha; usuário autorizado altera colunas/IDs | Primeiro é negado; segundo recebe somente registros e campos permitidos. |
| AC28 | Link de arquivo é reutilizado em outra ficha ou acessado após revogação | Validação atual por objeto/finalidade impede acesso indevido. |
| AC29 | Permissão, dono, recusa do contato ou situação da cobrança muda antes do envio | Despacho revalida a intenção e não envia com autorização/condição vencida. |
| AC30 | FIN pesquisa responsável compartilhado por irmãos | Obtém somente vínculo e dados necessários ao atendimento autorizado, sem abrir automaticamente os demais alunos. |

Além desses cenários, preservar as regressões da auditoria 34 para saldo parcial, ativação, vínculos de documento, fila WhatsApp e transições acadêmicas. Uma alteração de expectativa por decisão de produto deve ser explícita; não apagar o registro do comportamento originalmente reproduzido.

## 9. Estruturas necessárias e sequência de implementação

### Diferenças entre política e modelo atual

| Necessidade | Base existente | Complemento necessário |
|---|---|---|
| Quatro dimensões por operação | Papéis, guards e alguns filtros por usuário | Capacidades e projeções coerentes; condições aplicadas a todos os caminhos. |
| Equipe e cobertura temporária | `vendedorDonoId` e papéis | Equipe supervisionada e concessões com escopo, início/fim, revogação e autor. |
| Desconto acumulado por componente | Preços, valores de cobrança e `Usuario.limiteDescontoPct` | Referência da negociação, limites distintos de taxa/mensalidade, versão e validação em todas as entradas. |
| Comissão percentual/fixa | `Comissao.percentual`, valor, moeda e estado | Política de cálculo versionada, modo fixo/percentual, memória de cálculo e ajustes que preservem pagamento. |
| Conferência de pagamento | Cobrança acumulada, comprovante e eventos | Informe independente, recebimento com identidade própria, conferência e controle de repetição/concorrência. |
| Assunção e correções | Lead, matrícula e aluno | Responsabilidade/instante da assunção e solicitações de correção rastreáveis. |
| Histórico docente em leitura | Professor atual da turma e alocação do aluno | Atribuição docente temporal, aulas/diário com autoria e vínculos históricos. |
| WhatsApp por finalidade | Conversa por número/contato e mensagens | Contexto de atendimento, participantes e associação de mensagens/mídias; tratamento do histórico legado. |
| Campos e textos por finalidade | Cadastro, observações e eventos genéricos | Contratos de leitura/escrita e classificação de notas, documentos e eventos compartilháveis. |
| Exportação controlada | Modelos/importações de alunos e turmas | Permissão por conjunto de dados, geração/download autorizados e registro da operação. |

### Ordem proposta

1. **Fechar as falhas de acesso existentes:** escopo de consultas/ações, projeções de campos, páginas de configuração, arquivos e revogação. Incorporar regressões correspondentes da auditoria 34.
2. **Unificar preço, alçada e aprovação:** criação/ajuste com referência por componente, proibição de autoaprovação e política configurável de comissão. Preservar os registros financeiros existentes na migração.
3. **Separar informe de recebimento e correção cadastral:** novos fluxos D01/D05, integridade de pagamentos e pré-condições de ativação. Resolver as regras financeiras necessárias antes de habilitar cada transição.
4. **Implementar equipe, cobertura e atendimento institucional:** acesso por finalidade, transferência, expiração e nova validação de mensagens pendentes. Não ampliar automação enquanto os respectivos bloqueadores da auditoria persistirem.
5. **Entregar diário e histórico docente e exportações controladas:** novos modelos e capacidades, com testes positivos e negativos das projeções e vínculos.

Não é necessário construir todas as funcionalidades futuras para corrigir o acesso ao que já existe. Cada entrega precisa declarar quais decisões cobre, quais caminhos foram testados e quais partes continuam sem implementação.

## 10. O que ficou definido e o que permanece parametrizável

As quatro dimensões, as decisões D01–D09 e seus contratos de acesso estão detalhados. Permanecem para cadastro operacional: percentuais máximos de desconto, regra/valor da comissão aplicável, integrantes das equipes, pessoas aprovadoras, prazos concretos de cobertura e vigência das políticas. Isso é parametrização deliberada; não é autorização para o código escolher números arbitrários.

Na conclusão deste detalhamento, em 07/09, ainda faltavam decisões sobre ativação/contrato, retomada financeira após pausa, restrição de acesso às aulas e conferência de comprovante. **Atualização de 08/09:** ativação, restrição e conferência foram respondidas e estão descritas como D10–D12 nos docs 36/38. A retomada foi definida como D13: escolha entre manter vencimentos ou reprogramar parcelas, mediante proposta aprovada por outra pessoa; detalhes no [doc 39](39-retomada-com-aprovacao.md). Mudanças futuras nos gatilhos de aquisição/estorno de comissão exigem definição própria.

**Verificação da etapa documental de 07/09:** leitura direcionada de código, inventário de funções/rotas, consulta às fontes oficiais e revisão dos documentos. A implementação posterior e seus resultados executados constam no [doc 38](38-implementacao-acesso-validacao.md); não decorrem apenas da aprovação deste detalhamento.

Conferência documental de 07/09: as 73 funções de ação inventariadas estavam nominalmente relacionadas no mapa; os 30 cenários de aceite eram especificações, sem resultados de execução nesta tabela. Foram verificados 64 links locais no índice e nos docs 36/37, sem referências ausentes; revisão de espaços e `git diff --check` sem erros. Essas verificações documentais não testam o comportamento da aplicação.
