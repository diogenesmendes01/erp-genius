# Desistência de matrícula em preparação — Q121

## Regra aprovada

A unidade é a matrícula, preservando os demais contratos do aluno. Registrar pedido, motivo e evidências. Sem comprovante em conferência, pagamento confirmado ou assinatura, a Secretaria poderá efetivar depois de atender os demais requisitos. Havendo avanço formal, Secretaria/Administração prepara e outra pessoa da Administração aprova. Acúmulo de papéis não permite autoaprovação.

Cobranças e valores exigem conferência; quando necessário, Financeiro prepara o acerto e outra pessoa autorizada o aprova. Não presumir retenção, devolução ou perdão de saldo. Devolução efetiva permanece operação separada. Preservar documentos, recebimentos e histórico.

Uma solicitação externa de assinatura aberta precisa de encerramento confirmado pelo serviço antes da efetivação. Resultado incerto mantém a pendência. Assinatura ou pagamento concorrente exige nova conferência; ausência de registro local não comprova ausência de assinatura externa. Liberação de reserva depende da decisão válida e não equivale a cancelamento contratual ou devolução.

## Implementado no incremento 593

Secretaria/Administração ativa consulta a conferência e registra um pedido imutável, com motivo, evidência, versão sequencial e chave de reenvio. A conferência identifica matrícula, reservas coletivas/particulares, condições de entrada, documentos/processos de assinatura e fatos financeiros, incluindo créditos existentes ainda sem utilização. O servidor calcula uma impressão do estado e recusa pedido novo se esse estado mudou desde a consulta.

Crédito existente sinaliza conferência financeira; sua mera existência não comprova pagamento confirmado desta contratação. Esta etapa não calcula saldo disponível nem autoriza uso/devolução.

A consulta retorna resumo operacional, sem valores financeiros, URLs dos documentos ou dados de signatários. O registro interno conserva a fotografia conferida; os arquivos são representados por identificação e hash, sem guardar suas URLs na fotografia. Mostra os vinte pedidos mais recentes e se a conferência continua atual. Não existe paginação do histórico nesta etapa.

A mesma chave e conteúdo retornam o pedido já registrado, sem duplicação, inclusive sob concorrência. Chave reutilizada com conteúdo diferente é recusada. Revalidar usuário e matrícula sob bloqueio. O banco impede alteração/exclusão do pedido e valida estado preparatório, papel ativo, versão e identificação da matrícula na fotografia. Essas proteções não certificam integralmente o conteúdo de uma fotografia inserida diretamente no banco; o pedido nunca serve, sozinho, como autorização de execução.

Tela em `/matriculas/[id]/desistencia`, acessível pela preparação aos papéis autorizados. Matrícula fora da preparação mantém consulta do histórico, sem formulário de novo pedido.

## Efetivação simples — incremento 594

Preparação sem cobranças, créditos, documentos, processos de assinatura, alocações ou reserva utilizada pode seguir para efetivação pela Secretaria/Administração. A conferência final deve registrar como a equipe verificou também os canais externos. Apenas o pedido mais recente, ainda correspondente às fontes, pode ser executado. Não exigir outro aprovador neste ramo, conforme Q121.

A aplicação muda somente essa matrícula para `CANCELADA` e libera as reservas coletivas e particulares em `ATIVA` ou `MANTIDA_PENDENCIA`, preservando reservas já expiradas/liberadas, o pedido, a preparação comercial, aluno e outros contratos. Reserva liberada deixa de ocupar vaga/horário. Não gerar estorno de comissão ou devolução sem fatos e fluxo financeiro próprios.

Uma aplicação imutável identifica pedido, matrícula, executor, motivo e data. Reenvio idêntico retorna a aplicação; confirmação diferente é recusada. A interface conserva autoria e histórico, sem propor nova efetivação de um caso já aplicado. Anexo documental posterior pode registrar evidência tardia e sinaliza conferência; não apaga ou desfaz a aplicação por conta própria.

A execução e as reservas devem permanecer coerentes no banco, inclusive em concorrência ou tentativa de escrita direta. Evidências de validação e limitações da rodada: [incremento 594](../planejamento/validacao-incremento-594.md).

## Cancelamento de cobranças ainda não pagas — incremento 595

Financeiro/Administração prepara uma proposta para o último pedido de desistência, com motivo, evidência das condições e fotografia das cobranças. Outra pessoa do Financeiro com `financeiro.aprovar_acertos` ou da Administração aprova. A decisão não efetiva a desistência: Secretaria/Administração aplica depois, mediante nova conferência das fontes e das permissões dos participantes.

Este ramo aceita cobranças pendentes/atrasadas integralmente não pagas e cobranças já canceladas coerentes, sem recebimentos, créditos, comprovantes em conferência/confirmados, documentos, assinatura, alocações ou ajustes que exijam outro tratamento. Cobrança legada não recebe uma origem inventada. O acerto não permite presumir retenção nem devolução.

Na efetivação, as cobranças pendentes/atrasadas passam a CANCELADA e recebem vínculo com a aplicação. Valores originais/negociados, saldo histórico e vencimento permanecem preservados; não há recebimento fictício. Cobranças já canceladas permanecem inalteradas. A matrícula é cancelada e as reservas ativas/mantidas são liberadas na mesma transação, sem alterar outros contratos do aluno.

Depois da aplicação, todas essas cobranças canceladas ficam protegidas contra alteração/exclusão e novos recebimentos/informes, inclusive as que já estavam canceladas sem vínculo com a nova aplicação. Reenvios idênticos não duplicam proposta, decisão ou efetivação. Fonte alterada, decisão de outro pedido, autoaprovação ou perda de alçada impedem aplicação.

A fila `/financeiro/desistencias` e a conferência `/matriculas/[id]/desistencia/financeiro` são exclusivas de Financeiro/Administração. A Secretaria recebe a autorização operacional sem os valores financeiros. O histórico financeiro mostra as vinte propostas mais recentes; a fila de matrículas tem paginação por cursor.

Evidências e limites: [incremento 595](../planejamento/validacao-incremento-595.md).

## Conferência documental — incremento 596

Secretaria/Administração consulta os documentos e processos da matrícula em `/matriculas/[id]/desistencia/documentos`, a partir do pedido de desistência. A consulta revalida o papel ativo e identifica o pedido mais recente. Retorna nomes/categorias dos documentos, estado dos processos, serviço/ambiente, existência de referência externa e conclusão registrada, sem URLs, hashes de evidência, referência externa real ou dados de signatários.

Envio preparado, em andamento, incerto, enviado ou cancelamento registrado não são autorização de desistência. Ausência de registro local não comprova ausência de envio externo. Uma conclusão registrada exige tratamento contratual próprio. Resultados de cancelamento para substituir contrato permanecem identificados como substituição; não são consumidos como encerramento Q121.

Esta conferência é somente leitura. Não registra decisão administrativa, não solicita cancelamento externo e não libera a aplicação dos casos documentais. Ela fornece a revisão contextual necessária à próxima etapa. Evidências e limites no [incremento 596](../planejamento/validacao-incremento-596.md).

### Separação exigida para a execução documental seguinte

A proposta de desistência precisa de decisão própria e das aprovações exigidas pelo avanço formal. Para uma solicitação externa aberta, persistir a intenção específica de encerramento antes da chamada; reenvio ou resultado incerto exige conciliar essa intenção, sem gerar outra solicitação silenciosamente. Preservar evidências autenticadas do serviço. Conclusão concorrente impede tratar o caso como simples cancelamento de uma solicitação ainda aberta.

Na aplicação, conferir novamente pedido, condições financeiras, processos, decisões e reservas. Não gerar contrato substituto. Uma observação externa confirmada não equivale, sozinha, a desistência efetivada nem a devolução financeira. O adaptador autenticado depende da escolha de fornecedor/plano ainda pendente em Q155; as primitivas de teste existentes não comprovam integração operacional.

## Decisão administrativa — incremento 597

O pedido registrado pela Secretaria/Administração é a proposta submetida à decisão administrativa quando houver o avanço formal definido em Q121. Outra pessoa da Administração, ativa no momento da decisão, pode aprovar ou rejeitar com justificativa. Acumular papéis não permite decidir o próprio pedido. A decisão identifica a versão conferida e permanece imutável; uma nova análise exige novo pedido, preservando o anterior.

A aprovação exige o último pedido, matrícula ainda em preparação, necessidade de aprovação administrativa e condições correspondentes à conferência registrada. Alteração das fontes impede aprovação daquela versão. A rejeição pode documentar um pedido histórico, conservando sua referência, desde que a desistência ainda não tenha sido efetivada. Reenvio idêntico recupera a decisão existente, sem duplicação; outro conteúdo não a substitui.

A tela `/matriculas/[id]/desistencia/administracao` permite consulta pela Secretaria/Administração, mas o formulário depende de Administração independente. Não expõe valores financeiros. Mostra os vinte pedidos mais recentes e suas decisões, distinguindo a aprovação histórica de condições que já mudaram.

A decisão é uma etapa de autorização do pedido. Não cancela cobranças, não confirma recebimentos, não encerra solicitação externa e não efetiva a desistência. O aplicador dos casos com avanço formal deverá exigir esta decisão e os tratamentos correspondentes, revalidando as fontes. Os aplicadores restritos anteriores continuam recusando esses casos. [Evidências e limites](../planejamento/validacao-incremento-597.md).

## Ainda necessário para cumprir Q121 integralmente

1. Conferência documental própria da desistência e encerramento externo confirmado, incluindo eventos tardios/incertos. O cancelamento existente para substituição de contrato não autoriza desistência.
2. Acertos da preparação com recebimentos, créditos ou outros efeitos além do cancelamento de cobranças não pagas, conforme os fatos e condições aplicáveis, com aprovação independente. Não reutilizar cálculos pós-ativação como se fossem automaticamente equivalentes.
3. Integrar a decisão administrativa à efetivação dos casos com tratamento financeiro/documental: revalidar fontes, aplicar estado final e tratar/liberar reservas uma única vez, mantendo os outros contratos.
4. Interface de revisão, decisão, pendências e execução; testes concorrentes entre assinatura, pagamento, ativação, reserva e desistência, além de homologação interativa.

O registro do pedido, sozinho, não cancela matrícula, cobrança, assinatura ou reserva. O ramo simples permite efetivar uma preparação sem os avanços descritos acima; não calcula acerto e não devolve dinheiro. O incremento 595 acrescenta somente o ramo financeiro descrito acima. O fluxo completo permanece pendente. Evidências: [incremento 593](../planejamento/validacao-incremento-593.md).

A forma de apurar o acerto da preparação com valores já pagos foi definida na [Q165](../planejamento/acerto-desistencia-q165.md): somente regra contratual estruturada. A implementação parcial e suas pendências estão descritas abaixo.


## Fila administrativa — incremento 598

Secretaria e Administração consultam `/secretaria/desistencias`, com paginação de vinte matrículas. A fila apresenta somente o pedido mais recente ainda sem decisão administrativa, para matrículas em preparação com sinais de avanço formal no estado atual ou na fotografia do pedido. Uma decisão no pedido atual não faz pedidos antigos reaparecerem. Fontes alteradas permanecem indicadas para conferência; a fila não autoriza aprovação.

A consulta revalida usuário ativo e papel no banco, inclusive antes de devolver a página. Secretaria acompanha sem decidir; outra pessoa da Administração decide na tela própria. Não devolver valores financeiros, fotografias internas ou URLs documentais. Casos já decididos e acertos financeiros pendentes não constituem o escopo desta fila. [Evidências e limites](../planejamento/validacao-incremento-598.md).

## Acerto contratual Q165 — implementação parcial

Para matrícula ainda em preparação, o Financeiro prepara uma memória a partir da versão contratual estruturada, aprovada e vigente. A fonte dessa versão é o contrato aceito atual ou, antes do aceite, o original contratual conferido e enviado com referência externa, ligado à mesma matrícula, artefato e processo de assinatura. A fonte pré-aceite só vale para a regra de acerto antes da ativação; não transforma o original em aceite nem libera outros encerramentos. A memória contém a fotografia integral das cobranças, recebimentos, informes, usos de crédito, compensações, créditos e créditos previamente apurados. Outra pessoa com alçada financeira aprova ou rejeita a memória. A aplicação exige também decisão administrativa Q121 aprovada, independente e ligada ao mesmo pedido e estado; ela não substitui a decisão financeira.

A aplicação é executada pela pessoa que aprovou a memória, altera somente os valores calculados pela regra contratual e cria crédito apenas para excedente comprovado, com origem por cobrança. A Secretaria efetiva usando o identificador dessa aplicação; revalida decisão administrativa independente, fonte contratual, condições, efeitos financeiros e processos de assinatura. Processo sem conclusão impede o ato. Para o original pré-aceite, o serviço pode encerrar o envio sem criar substituto somente após pedido Q121, decisões financeira e administrativa, aplicação Q165 e confirmação externa preservada; a intenção referencia o pedido e a decisão administrativa, e o processo passa a cancelado. A tela financeira é exclusiva de Financeiro/Administração; a Secretaria não recebe valores nessa tela e usa a efetivação existente. Créditos criados possuem ligação para o histórico do aluno.

Depois da primeira aplicação Q165 da matrícula, não pode existir outra aplicação enquanto a Secretaria não efetivar a desistência. A guarda transacional exige o pedido vigente e bloqueia também inserção direta ou corrida concorrente. Informe de pagamento, recebimento destinado, crédito sem destino ou alteração das demais fontes financeiras posterior à aplicação permanece registrado e bloqueia a efetivação pela fotografia divergente. A correção exige uma revisão complementar por delta, ainda não implementada: ela deve referenciar a primeira aplicação, identificar o fato novo, calcular somente a diferença e passar novamente pelas alçadas independentes. Não se deve reaplicar a memória original, apagar o recebimento nem declarar a desistência efetivável enquanto essa pendência existir.

Uma rejeição financeira não apaga a memória preparada. O Financeiro pode reapresentá-la somente como uma nova versão ligada à anterior, com motivo explícito. A versão anterior permanece preservada com sua decisão; somente a última versão da cadeia pode receber nova decisão ou aplicação. Um fato posterior a uma memória já aprovada invalida o pedido e a Q121 associados: a página financeira informa que a Secretaria deve registrar novo pedido, identificando esse fato na solicitação. O novo pedido permanece no histórico versionado da matrícula e inicia outra memória Q165 com nova decisão financeira e nova Q121, sem reaproveitar a decisão anterior. Se já houve aplicação, esse novo ciclo fica bloqueado até a revisão complementar por delta ser implementada. A cadeia não reabre, não altera nem reaplica uma memória que já produziu a primeira aplicação Q165.
