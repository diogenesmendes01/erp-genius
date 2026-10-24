# QA independente preliminar — SOMENTE ESTÁTICA #325

Fonte exata `05588ca5ddb15774fce21ca1a1fb8cb740d23a96`, pai `8d843c06e52eaf78d2232a3033be10d0e9b59650`. Parecer preliminar favorável aos contratos e à composição lidos, sem blocker estático identificado. Não é QA de execução ou visual. Mantive checkout `7d9f565c3b840b64ec6b88dc4d2c4446a95803f5` e cliente490, sem checkout/testes487.

`27ac9d`, exit0, confirmou **12 paths =9TS/TSX +SPEC/report/quadro**; hook useAbaPainel e seu teste byte-idênticos a2de9. Produtor/DTO/servidor/lib/componentes/schema/harness/package/lock não mudam contra o pai. Prefixo do quadro preservado; diff-check0 e tracked limpo. Leitura foi feita com gitshow/diff da fonte exata, não do meu checkout337.

D13/B2B: AbaDetalhes e BlocoB2B recebem o DTO contextual já autorizado, sem resolver atendimento ou Pessoa no navegador. Dados de Pessoa, Empresa e oportunidade permanecem distintos; filtros de pessoa legal/carteira/linha/campos continuam no produtor inalterado. Campos usam LinhaCampo, null explícito, booleano/zero/data e autoriaAria do DTO. A renderização não concede contatos.editar, envio ou CRMglobal. Abrir ficha completa depende de verContato; Ver empresa depende de verEmpresa; IDs de navegação são codificados. Conteúdo textual é escapado pelo React.

O participante atual recebe Na conversa; os demais só recebem Falar com se hrefConversa do produtor336 não fornull. O link usa exclusivamente esse destino autorizado; não fabrica rota/atendimento nem chama envio. Leitura do convidado não se torna escrita, e o destino continua revalidando acesso. Nenhum editor325, form de alteração ou capacidade adicional foi acrescentado.

Aquisição: há uma única chamada useAbaPainel em InboxNovo, ativa para Detalhes comercial individual; grupos e outros setores não adquirem o DTO comercial. Chave atendimento/aba/versão/tentativa, no-store, AbortController e invalidação de respostas antigas preservam o contrato já revisado326. Loading, erroalert/Retry e dados/ausência são distintos; retry devolve foco ao painel antes da recarga. Não há polling ou novaSSE. A futura composição com326 deve reutilizar ESSA instância com ativo=Detalhes OU editor, não importar segunda aquisição; isso é pendência de composição, não editor já entregue aqui.

Cabeçalho comercial usa subtítulo/quadrado do servidor. Cartão atual exibe produto ou título, valor/moeda e etapa, sem mensalidade presumida; continua link /funil?o=id. A aba completaOportunidades327 não é antecipada nem uma aba vazia habilitada. Aria, ações de contato, opt-out e triagem existentes mantêm os gates abaixo dos detalhes; fora do comercial continua a composiçãoE1.

Os novos testes fonte cobrem leituraB2B convidada sem links globais, destino autorizado/null/NaConversa, aquisição única, não aquisição fora do comercial e Retry; apenas os li, sem executá-los. Gates DEV924/7252, INT3/41, TSC/lint permanecem evidências do DEV e não são aprovação própria nesta rodada.

Nenhum UNIT/TSC/INT, Prisma/DDL, instalação, troca de perfil/cliente, browser/HTTP, UI/nota ou captura, edição de fonte, push/PR/merge. Harness325/visual ainda serão entregues; não há aceite de geometrias/links navegados/pixels ou issue concluída. Aguardo próxima fonte337 do ROOT e posterior preparo487 explícito para os gates325.
