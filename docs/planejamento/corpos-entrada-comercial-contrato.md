# Corpos de entrega — entrada comercial e documento contratual

**Consolidado em 10/09/2026 para revisão técnica e de escopo.** Complementa os [14 corpos anteriores](revisao-integracao-corpos-entregas.md) com quatro corpos, totalizando 18 propostas de entrega. Os IDs COM01/DCT01–DCT03 são referências internas, não issues criadas. A divisão é uma proposta técnica; regras de negócio vêm das respostas [Q103–Q123](entrada-comercial-e-contrato.md), da [SPEC da matrícula](../specs/matricula-como-unidade-operacional.md) e da [SPEC documental](../specs/documento-contratual.md).

As 23 perguntas desse registro foram respondidas. Nenhum critério abaixo foi executado nesta etapa documental. Os corpos tornam o escopo revisável antes de criar issues e implementar; não declaram integrações, cobrança ou assinatura funcionando.

## 1. Fronteiras entre entregas

| Responsável | Dado/comportamento que mantém | Integração exigida |
|---|---|---|
| B01 | Identidade única do aluno, matrícula operacional, condições e vínculos por contrato | COM01 cria a nova contratação sem duplicar pessoa; documentos preservam a versão das condições. |
| B02 | Cobrança, recebimento original, destinação, crédito, acerto e devolução | COM01 fornece o gatilho de emissão e a desistência; não cria outro controle de saldo ou pagamento. |
| F07.2/F07.3 e P01 | Encontros, disponibilidade, mudanças aprovadas e regras da oferta particular | COM01 reserva capacidade/horários na mesma fonte de disponibilidade; reserva não é participação acadêmica ativa. |
| COM01 | Negociação, preparação, conferência da Secretaria, reserva/admissão e progressão até ativação/desistência | Exige evidência documental de DCT02 e pagamentos confirmados de B02 quando aplicáveis. |
| DCT01 | Modelos aprovados, dados congelados e PDF protegido | Não envia ao cliente nem confirma assinatura ao gerar a prévia. |
| DCT02 | Liberação, participantes/etapas, integração de assinatura e evidências | Consulta requisitos da contratação e fornece resultado verificável para conferência; não ativa matrícula. |
| DCT03 | Aditivo, aprovações, formalização e aplicação das novas condições | Reutiliza DCT01/DCT02 e atualiza condições de B01 conforme vigência, sem reescrever recebimentos de B02. |
| N01 | Infraestrutura comum de avisos e resultados, quando utilizada | Não presumir que convite do portal seja convite para assinar. Comunicação do processo de assinatura pertence a DCT02, sem envio duplicado por dois caminhos. |
| M01/V01 | Migração e validação integrada | Não recriar documentos/assinaturas históricos; verificar a jornada real pelos papéis corretos. |

As chamadas conceituais das SPECs são contratos internos, não nova API pública. Definir tabelas, transações e entradas/saídas concretas na revisão técnica, preservando estas responsabilidades. Dados financeiros completos não são expostos ao professor/gestão pedagógica para conferir apenas disponibilidade ou admissão.

## 2. COM01 — Conduzir a negociação até a matrícula, com reserva e conferência

**Problema e resultado:** o fluxo atual cria pessoa, cobranças e eventual alocação ativa ao salvar matrícula. A nova jornada deve separar interesse, contratação em preparação, reserva, conferência, emissão e ativação. Quem já é aluno contrata outro serviço com a mesma identidade e uma negociação/matrícula independente.

**Decisões:** Q103, Q107–Q113, Q118–Q121; integrar Q105/Q106, Q100/Q102 e a política de acesso/comissões vigente.

**Escopo:**

- Vendedor registra identificação básica, contato, oferta e condições da negociação. Ao prosseguir com contratação disponível, cria preparação e reserva temporária com prazo configurado; criação repetida da mesma negociação não duplica matrícula ou reserva.
- Separar autoria, responsável da nova negociação e beneficiário de comissão conforme política. Reutilizar identidade confirmada com projeção restrita; cobertura não muda titular e venda nova não abre contratos anteriores.
- Turma deve estar publicada, com professor, capacidade e admissão válidos. Data-limite por turma permite ingresso após o início dentro da janela. Reserva anterior que ultrapasse o limite só permite ingresso com exceção pedagógica independente de Q110; nunca em turma concluída.
- Particular contratada usa o regime da oferta: grade fixa reserva os horários recorrentes acordados; flexível reserva pelo menos o primeiro encontro. Registrar professor e conferir conflitos com reservas e aulas, sem misturar cota gratuita de reposição.
- Secretaria assume, completa e confere documentos, endereço, pagador e participantes aplicáveis. Exigir dados suficientes para cada efeito; após assunção, vendedor solicita correções.
- Emitir taxa uma vez após conferência e requisitos de Q112. Aplicar os quatro caminhos iniciais de Q119: mensal exigida e adiantamento por hora exigido após conferência; mensal não exigida na ativação; hora sem adiantamento pelo fechamento mensal de P01.
- Reserva vencida sem comprovante em conferência, pagamento confirmado ou assinatura expira conforme Q108. Com qualquer desses fatos da contratação, manter ocupação e pendência; resolução de prorrogação/liberação exige proposta de Secretaria/Administração e aprovação por outra pessoa da Administração, conforme Q118.
- Q123 mantém preparação pendente de nova reserva após expiração sem avanço formal. Encerrar assinatura aberta com resultado confirmado; retomar a mesma matrícula somente com disponibilidade, dados e condições revalidados. Preservar cobranças e tratar fatos concorrentes sem presumir vaga/ativação/devolução. Incorporar MAT-29.
- Desistência de Q121: Secretaria efetiva sem avanço formal com requisitos cumpridos; havendo algum dos fatos acima, Secretaria/Administração propõe e outra pessoa da Administração aprova. Acerto financeiro necessário tem aprovação própria; solicitação de assinatura aberta precisa de encerramento confirmado. Preservar outros contratos, documentos, dinheiro e tratamento separado de devolução.
- Ativação confere aceite, pagamentos exigidos, disponibilidade/reserva e admissão atuais. Transformar reserva em participação sem contar capacidade duas vezes. Não exigir mensalidade fictícia por hora nem cobrança que só nasce na própria ativação como requisito prévio circular.

**Permissões e estados:** reutilizar os papéis autorizados de criação/ativação e a assunção pela Secretaria, sem ampliar poderes apenas por atribuir a venda. Modelar a preparação, reserva, conferência, pendências, ativação e desistência como fatos distintos. Aprovação independente continua exigindo outra pessoa, mesmo com múltiplos papéis.

**Aceite:** incorporar MAT-17–MAT-29 e a base de isolamento MAT-01–MAT-16. Demonstrar também:

- [ ] Última vaga disputada por duas contratações: apenas uma reserva; repetir tentativa não ocupa outra vaga. Reservas protegidas continuam na contagem após o prazo.
- [ ] Mensal com/sem primeira mensalidade exigida e hora com/sem adiantamento seguem os quatro gatilhos, sem duplicar cobrança ou inventar recebimento.
- [ ] Publicação, conflitos, admissão e exceção após limite são conferidos em chamadas diretas ao servidor, não apenas nos botões.
- [ ] Outro vendedor contrata novo serviço para aluno existente sem ler contratos anteriores, alterar comissão passada ou duplicar pessoa.
- [ ] Pagamento/assinatura chegando durante desistência muda a autorização necessária; incerteza externa mantém pendência, e repetição não duplica liberação/acerto.
- [ ] Ativação recusada não deixa participação acadêmica indevida; operação válida converte a reserva uma vez e preserva os contratos excluídos.

**Dependências/limites:** B01/B02, disponibilidade de F07.2/F07.3, oferta por hora P01 e aceite de DCT02. Desenvolvimento pode usar contratos internos testáveis; habilitação exige a integração completa. Não inclui funil genérico de tarefas, comissão nova por inferência, cobrança bancária integrada, autoassinatura, parâmetros numéricos presumidos ou venda sem disponibilidade.

## 3. DCT01 — Publicar modelos e gerar PDFs contratuais versionados

**Problema e resultado:** atualmente a Secretaria anexa arquivo pronto. O ERP deve gerar contrato/aditivo por modelo institucional aprovado, mantendo os dados e a versão utilizados e sem cláusulas livres na venda.

**Decisões:** Q104/Q113–Q115; suporte documental a Q117 e sequência fixa de Q122.

**Escopo:** proposta de modelo por Secretaria/Administração; aprovação/publicação por outra pessoa da Administração; conteúdo, campos, condições de aplicação e papéis obrigatórios versionados. Identificar os participantes do cliente e da escola conforme regras aplicáveis, sem presumir que todo pagador assine. Preparar dados autorizados, indicar campos faltantes, gerar prévia e armazenar PDF protegido, identidade da versão e integridade. Reabrir documento retorna o arquivo preservado; mudar catálogo/cadastro não o regenera silenciosamente.

Conteúdo real dos modelos será fornecido/validado pela escola. Dados para geração têm origem conferida e incluem condições estruturadas de B01 quando aplicáveis. Modelos de ensaio precisam ser identificados como tais e não podem ser usados como contrato real.

**Permissões e estados:** rascunho de modelo não está publicado; aprovação de modelo não substitui conferência da matrícula ou alçada comercial. Rejeitar autoaprovação e edição de versão já utilizada; publicar mudança por nova versão. Consultas, metadados e arquivo seguem o acesso ao documento da matrícula, sem URL pública por conveniência.

**Aceite:** DOC-01–DOC-04 e DOC-09–DOC-14 quanto a geração, integridade, governança, participantes e acesso; etapas de envio/aceite permanecem responsabilidade de DCT02.

- [ ] Secretaria prepara modelo, mas não publica sozinha; Administração que preparou não aprova a própria versão.
- [ ] Campo obrigatório ausente bloqueia geração/liberação dependente e indica o que falta; não insere cláusula, pessoa ou condição fictícia.
- [ ] Alteração de cadastro/modelo não muda PDF já gerado; falha/repetição de geração não libera arquivo parcial nem duplica versão lógica.
- [ ] Participantes exigidos vêm do modelo aplicável, preservando identidade/representação e distinção entre pagador e signatário.
- [ ] Usuário fora do escopo não consulta prévia, arquivo ou metadados por ID direto.

**Dependências/limites:** B01 e conferência/dados de COM01; armazenamento protegido existente pode ser reaproveitado. Não seleciona fornecedor de assinatura, não envia documento, não disponibiliza editor livre de cláusulas por venda e não altera contratos assinados.

## 4. DCT02 — Integrar assinatura, conferência e substituição de documento

**Problema e resultado:** arquivo anexado e conferência manual não comprovam geração, envio ou assinatura integrada. O ERP deve liberar o PDF conferido, acompanhar o processo e receber documento/evidências sem duplicar solicitações ou aceitar versão errada.

**Decisões:** Q105/Q106/Q115/Q116/Q121/Q122; integrar reservas e liberação de COM01.

**Escopo:**

- Conferir dados/documento e regra da oferta: exigir ou dispensar taxa confirmada antes da liberação, conforme Q105. Comprovante a conferir não satisfaz confirmação financeira. Demais requisitos de ativação permanecem.
- Identificar participantes previstos no modelo. Enviar juntos aos obrigatórios do cliente; após todos assinarem, encaminhar à escola quando exigida. Não oferecer ordem livre por venda/modelo nem assinatura automática pela escola.
- Preservar intenção de envio, processo externo, versão exata, destinatários autorizados, tentativas, retornos verificados e documento/evidências recebidos. Distinguir envio, entrega comprovada, assinatura parcial, conclusão, recusa, expiração/cancelamento e resultado incerto; não concluir por relógio ou evento de outro processo.
- Secretaria confere as evidências do documento correto. Retorno do fornecedor não ativa matrícula ou confirma pagamento por si só. Assinatura parcial informa a proteção da reserva de Q108.
- Substituição de Q116: Secretaria/Administração prepara versão substituta, motivo e diferenças; outra pessoa da Administração aprova, com alçadas aplicáveis. Confirmar encerramento da solicitação anterior antes de liberar nova versão. Preservar assinaturas parciais sem copiá-las para a substituta; não gerar taxa novamente.
- Desistência usa autorização de COM01/Q121 e retorno confirmado da solicitação aberta. Se todas as assinaturas se concluírem durante tentativa de encerramento, preservar resultado e encaminhar à conferência do tratamento aplicável; não declarar contrato automaticamente inválido.
- Expiração sem avanço formal de Q123 também encerra solicitação ainda aberta, com confirmação antes de nova liberação. Preparação continua, mas processo externo encerrado não é reaberto automaticamente. Incorporar DOC-19.
- Para contrato totalmente assinado, mudanças de condições seguem DCT03. Encerrar solicitação externa, desistir da contratação e executar devolução são operações distintas.

**Permissões e estados:** requisitos consultados no servidor no momento dependente; documentos e participantes pertencem à matrícula/processo exatos. Preparador não aprova substituição ou desistência que exija decisão independente. Professor, gestão pedagógica e novo vendedor não recebem acesso documental amplo por participar de evento relacionado.

**Aceite:** DOC-05–DOC-08 e etapas de liberação/retorno de DOC-09–DOC-12; DOC-14/DOC-15/DOC-17/DOC-18 e integrações MAT-19/MAT-28.

- [ ] Taxa prévia exigida/dispensada produz caminhos corretos; falta de conferência ou requisitos impede liberar.
- [ ] Múltiplos participantes do cliente assinam em paralelo; escola só recebe após todos, se prevista. Modelo sem escola não fica preso em etapa artificial.
- [ ] Retornos falsos, repetidos, parciais, de outra matrícula/versão ou fora de ordem não satisfazem indevidamente a conclusão; estado verificado e evidências determinam o resultado.
- [ ] Falha/incerteza no envio ou encerramento gera conciliação antes de repetir, sem dois processos ativos por tentativa técnica.
- [ ] Substituição guarda versão/assinaturas anteriores; assinatura concluída concorrentemente impede tratar o documento como ainda não assinado.
- [ ] Conferência da Secretaria continua necessária, inclusive quando o serviço confirma todas as assinaturas.
- [ ] Comprovar comportamento real no fornecedor escolhido antes de homologar a integração; testes com substituto registram apenas validação local.

**Dependências/limites:** DCT01, requisitos/estados de COM01 e confirmação de B02; N01 somente quando reaproveitado para comunicação. Fornecedor/plano, credenciais, parâmetros técnicos, evidências disponíveis e canais compatíveis serão avaliados posteriormente. Referência antiga a DocuSign não é escolha atual. Este corpo não autoriza contratar plano, enviar documentos reais ou ativar serviços.

## 5. DCT03 — Formalizar e aplicar aditivos ao contrato assinado

**Problema e resultado:** alterar cadastro ou condição interna não formaliza uma mudança em contrato já assinado. Registrar aditivo ligado ao original e aos anteriores, coletar aprovações/assinaturas e aplicar apenas as condições formalizadas na vigência correta.

**Decisões:** Q117, com governança Q114, participantes Q115 e sequência Q122.

**Escopo:** Secretaria/Administração prepara condições anteriores/novas, base, motivo e vigência; outra pessoa da Administração aprova, além de alçadas comerciais/financeiras pertinentes. Reutilizar modelos/PDF de DCT01, assinatura de DCT02 e conferência da Secretaria. Preservar original, aditivos anteriores, pagamentos e vínculo à mesma matrícula. Aplicar condições uma vez quando formalização, vigência e base continuarem válidas; mudança concorrente exige conferência antes de aplicar.

**Permissões e estados:** distinguir proposta, aprovação interna, formalização, conferência e aplicação. Assinatura parcial ou aprovação interna não altera a condição em vigor. Composição de papéis não permite autoaprovar. Histórico das condições financeiras permanece identificado por vigência e origem.

**Aceite:** DOC-16/DOC-18, invariantes da matrícula e ajustes financeiros aplicáveis.

- [ ] Aditivo aprovado internamente, mas ainda sem assinaturas/conferência, não muda cobrança ou condições vigentes.
- [ ] Aditivo formalizado aplica somente as diferenças e vigência válidas; repetição não cria segunda matrícula/taxa nem reescreve recebimentos.
- [ ] Propostas concorrentes sobre a mesma base não se sobrepõem silenciosamente; mostrar conflito e exigir nova conferência pertinente.
- [ ] Original e aditivos anteriores continuam consultáveis por quem tem acesso; evidência de uma versão não aprova outra.
- [ ] Pausa, encerramento e mudança acadêmica mantêm fluxos já aprovados, sem passar a exigir aditivo automaticamente por esta entrega.

**Dependências/limites:** B01/B02, DCT01/DCT02 e permissões existentes. Modelos/conteúdo real de aditivos são insumos da escola. Não inclui substituir todo contrato por documento consolidado automaticamente, alterar pagamentos antigos ou criar cobrança de nova taxa pela edição das condições.

## 6. Integração, migração e revisão antes das issues

Ordem técnica proposta: firmar contratos internos de B01/B02/agenda → desenvolver COM01 e DCT01 sobre essas bases → integrar DCT02 aos requisitos de COM01 → acrescentar DCT03 → homologar os caminhos completos em V01. P01 fornece a variante por hora antes de habilitá-la. Isso não exige publicar etapas incompletas em produção nem implica dependência circular de construção: os requisitos consultados e os resultados de assinatura possuem contratos separados.

M01 precisa incluir identidade de negociação, responsável/histórico, correspondência de matrícula, cobrança inicial existente, documentos e reservas comprováveis. Não transformar upload legado em assinatura integrada ou criar reserva retroativa sem evidência. Comissão anterior conserva sua origem; importação não gera novas cobranças, contratos ou solicitações externas.

V01 acrescenta jornada vendedor → Secretaria → cobrança/assinatura → Financeiro → ativação, com os quatro caminhos de Q119; duas negociações do mesmo aluno; concorrência pela última vaga; reserva protegida e ingresso após limite; desistência com retorno externo incerto; substituição concorrente e aditivo com vigência. Executar cenários positivos e negativos por papel, além dos critérios individuais das SPECs.

| Pendente | Natureza e momento necessário |
|---|---|
| Revisar estes quatro corpos e contratos internos | Revisão técnica e de escopo antes de criar as issues; a divisão não altera respostas aprovadas. |
| Schema, migrações e entradas/saídas concretas | Decisões técnicas de B01/COM01/DCT01–DCT03; derivar estados, integridade, versões e autoria das SPECs. |
| Conteúdo/idiomas dos contratos e aditivos | Insumo institucional antes de publicar modelo real; não exige inventar cláusulas para desenvolver o mecanismo. |
| Serviço de assinatura, plano e operação | Escolha/validação adiada em Q106, necessária à implementação específica e homologação externa de DCT02. |
| Prazos de reserva, alçadas e demais configurações | Parâmetros da escola, sem números presumidos; operação dependente bloqueia com indicação do campo ausente. |
| Complementos de dados reais | Conferência em M01 antes da migração/habilitação do conjunto dependente; não bloqueia a revisão dos corpos. |

Q103–Q123 estão respondidas; a preparação após expiração segue Q123. A ampliação acadêmica Q124–Q154 está na SPEC-ERP-004, com limite por habilidade de Q134 e autorização independente de Q135; prazo de Q136 definido; consumo de tentativas definido em Q137; Q138 veda exceções de nota; Q139 define avaliações externas; Q140 define governança; Q141 define aplicação das versões; Q142 define oficialização; Q143 define portal acadêmico do aluno; Q144 define correções; Q145 delimita responsáveis; Q146 define segunda chamada; Q147 define limites; Q148 define consumo; Q149 define prazo; Q150 define extras; Q151 define pausa/encerramento; Q152 define substituição; Q153 define aproveitamento; Q154 define fechamento; corpo próprio pendente. Os 18 corpos aqui organizados não comprovam o detalhamento desse módulo. Novos conflitos de negócio devem ser apresentados ao usuário, preservando decisões aprovadas e distinguindo especificação, implementação e evidência de operação.
