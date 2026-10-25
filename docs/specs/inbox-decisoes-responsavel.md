# Inbox #354 — decisões pelo responsável atual da conversa

## Contrato de produto e limites

D1: o vendedor responsável ATUAL pela conversa também pode aprovar, rejeitar e desfazer sugestões da Aria. A nova exceção pertence ao Inbox: atendimento COMERCIAL no escopo atual, ação da mesma conversa, lead atual não nulo e existente, alvo efetivo coerente. Dono da oportunidade, convite, equipe, carteira e posse da linha não equivalem a responsável. Eles continuam compondo o acesso à conversa conforme as regras existentes.

Admin/GC mantêm o escopo global atual; alvo divergente não ganha exceção pela responsabilidade. capacidadesAria e as APIs globais aprovarAcaoAria/rejeitarAcaoAria/desfazerAcaoAria não liberam vendedor. /aria e CRM permanecem com suas permissões próprias. Nenhum schema, contrato de envio, pacote, edição ou ação de assumir é criado nesta entrega.

## Política compartilhada do Inbox

escopo-decisao-inbox.ts reúne a exceção D1 e a seleção agrupada de IDs de ações autorizadas. O produtor e a mutação usam o mesmo predicado e a validação de existência/pessoa do alvo. TAG/ATUALIZAR_CAMPO não podem apontar o payload para uma Pessoa diferente daquela do lead autorizado. Igualdade entre dois null não demonstra alvo válido.

A consulta do atendimento continua passando por escopoAtendimentos. A autorização geral aria.podeDecidir descreve o contexto da conversa; não autoriza todos os cartões, pois cada ação pode carregar um alvo próprio. Cartões são filtrados por ação. Nenhum novo caminho de leitura usa apenas a carteira ou o responsável para substituir o escopo autorizado da conversa.

## Transações e ordem

A fronteira decisao-inbox.ts recebe atendimentoId e acaoId e resolve tudo novamente no servidor. Ordem: ação FOR UPDATE; configuração necessária FOR SHARE antes do atendimento; atendimento FOR UPDATE; alvo específico e FKs pertinentes. Para CRIAR_TAREFA o fuso é capturado antes do atendimento e passado ao núcleo/executor; inclusive ausência da configuração não provoca aquisição posterior de Config. Sem advisory novo. O futuro #357 precisa tomar ações em ordem determinística antes do atendimento.

Usuário ativo/papéis, responsável, acesso ao atendimento e alvo são conferidos após as esperas. O lead é travado antes da escrita; TAG/campo têm pais e vínculos próprios protegidos; desfazer tarefa/agendada trava e confere a pertença do alvo. O snapshot do cliente e o payload não escolhem outro atendimento/lead/pessoa para a exceção.

historico.ts expõe somente três núcleos transacionais mínimos; os wrappers globais mantêm a semântica anterior. Em particular, o desfazer global conserva a diferença histórica de não recarregar decisorAtual após esperar ação; a fronteira Inbox exige frescor. Aprovar/rejeitar conservam repetição natural sem eventos/efeitos duplicados. Desfazer conserva a recusa de repetição e os impedimentos atuais de reversibilidade, estado humano posterior e mensagem já despachada.

buscarTrechos e janela-agendamento/transitivos aceitam cliente opcional, com default Prisma preservado. Contexto/executor encaminham tx: nenhuma segunda conexão é necessária para fontes, política, fuso, preços e respostas rápidas dentro da decisão. A aprovação só cria intenções ERP, sem chamada a provedor externo.

## DTO e custo

SugestaoAriaThread acrescenta capacidades por cartão, estados EXECUTADA/DESFEITA e autoria/data de desfazer. Os campos de capacidade são aditivos para compatibilidade de consumidores; a produção fornece valores reais e o servidor nunca usa sua ausência no cliente como autorização. Pode desfazer significa ação reversível aprovada/executada autorizada; a reversão continua revalidando o estado efetivo na hora da confirmação.

O produtor mantém primeiros20 autorizados, ordem ASC criadoEm/id e keyset100 sem cortar arbitrariamente candidatos. Pendentes vigentes, decisões recentes24h, execuções reversíveis recentes e ações desfeitas recentes compõem o histórico. As consultas de lead e nomes são agrupadas, sem N+1 por cartão. Há uma consulta agrupada adicional de existência/Pessoa por página; o ramo global mantém o helper de escopo comercial existente. Não há fetch por cartão, polling ou novo SSE.

Handoff mantém seu produtor e sua redação conforme acesso atual; D1 não amplia a visibilidade do resumo nem altera assumir/devolver. A remoção do painel legado #353 permanece.

## Componente, confirmação e identidade

CartaoSugestaoAria recebe atendimentoId e usa somente as três actions Inbox. Aprovar/rejeitar respeitam capacidade por cartão e bloqueio cliente404. Desfazer aparece só com capacidade própria, abre ConfirmarAcao real e executa somente dentro da sua prop acao. Há foco inicial seguro, cancelamento, feedback de erro/retry deliberado e proteção de identidade/capacidade da abertura.

A identidade inclui conversa e ação. Revogação404, perda de capacidade, desmontagem e troca A→B→A invalidam a geração; recuperar dados não reabre confirmação antiga nem aceita ACK antigo. Sem remount da conversa/rascunhos, query global de foco, autoenvio ou liberação pelo ACK. O estado de acesso revogado404→503→200 existente permanece no coordenador.

A guarda de botões continua fechada: exatamente dois controles dinâmicos da projeção original, suas variantes, e um terceiro literal Desfazer/contorno. Parser/resolvedor genérico intactos; negativos incluem terceiro vazio/variante errada e botão extra. Mapa declarativo exato.

## Evidências e pendências

Ver output/inbox-354-report.md e quadro-entregas.md para recibos de RED/GREEN e sessões terminais. A implementação não é considerada concluída por UNIT isolado. Integrações/concorrência e regressões estão em validação; QA independente, gates globais e visual pertencem às etapas coordenadas seguintes.

#355 cobre edição e autoria humana/pausa; #356 cobre pacote atômico; #357 cobre MANUAL/cancelamentos e bloqueio externo do compositor. Nada disso é declarado implantado pela #354.

## Fechamento técnico dos dois alvos

No Inbox, RESPONDER/ENVIAR_DOCUMENTO usam o lead efetivo atual no executor. Se oportunidadeId explícito da ação divergir desse lead, Admin/GC precisam do escopo global de AMBOS; o mesmo predicado em lote atende DTO e mutação. O wrapper trava os leads envolvidos em ordem determinística e revalida depois. A exceção do vendedor continua exigindo exatamente o alvo atual não nulo/existente. As APIs globais conservam o comportamento histórico, caracterizado separadamente; esta proteção adicional pertence à fronteira Inbox.

## Verificação DEV — 25/10/2026

- UNIT amplo77278/6a462d EXIT0:88 arquivos/1.087 casos completos, Inbox inteiro e guardas/cascos indicados no report. Anterior ao último fechamento dos dois alvos; UI permanece literal após esse gate.
- INT75695/ea223b EXIT0:5 arquivos/78 casos completos, incluindo DTO, convite/carteira/equipe/usuário após locks, três verbos, concorrência, histórico global, consultas e pool1/FTS/Config. Anterior ao último fechamento dos dois alvos.
- Depois do fechamento: UNIT75ea5e EXIT0,5 arquivos/41 casos; INT1074/01dec4 EXIT0,2 casos executados com filtro explícito alvo efetivo: e23 casos fora desse recorte. Não é nova execução completa dos78.
- Lint final26 arquivos838fc7 EXIT0, --max-warnings=0, sem supressões/configurações.

QA independente, TypeScript/gates globais do integrador e aceite visual continuam pendentes. Não marcar issue concluída por estes recortes. Sem PR/push/build/Next/browser/HTTP/install/schema/env nesta implementação. Banco reservado somente para as integrações coordenadas; não declarar restauração após os testes.
