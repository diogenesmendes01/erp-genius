# Política de acesso — reconstrução documentada

Reconstrução em 16/09/2026. O arquivo original citado como doc 36 não foi localizado no checkout nem no histórico Git disponível (`git log --all -- docs/36-politica-de-acesso-aprovada.md`). Este arquivo restaura a referência documental a partir das decisões preservadas; não é uma cópia recuperada do original nem evidência de implementação.

## Fontes e precedência

- [Doc 37](37-detalhamento-operacional-do-acesso.md): decisões D01–D09, escopos, projeções de campos e composição de papéis.
- [Doc 38](38-implementacao-acesso-validacao.md): decisões D10–D12. Seus resultados de teste e descrições de código são históricos.
- [Doc 39](39-retomada-com-aprovacao.md): D13, proposta e aprovação da retomada.
- [Doc 40](40-mudancas-academicas-com-aprovacao.md): D14, solicitação, parecer/dispensa justificada, aprovação e execução acadêmica.
- [SPEC central](specs/erp-educacional.md): decisões posteriores, invariantes e requisitos atuais, incluindo matrícula como unidade operacional. A fonte específica de cada fluxo detalha seu alcance.

A decisão explícita mais recente do usuário prevalece. A reconstrução não acrescenta alçadas, percentuais, prazos, permissões ou exceções; os detalhes permanecem nas fontes acima. Referências antigas que atribuem ao doc 36 uma consolidação em 07/09 devem ser lidas com esta ressalva de proveniência. Aprovação de produto não prova que o código atende à política.

## Quatro dimensões obrigatórias

| Dimensão | Conferência necessária |
|---|---|
| Ação | A pessoa possui capacidade vigente para consultar, propor, aprovar, executar ou exportar aquela operação? |
| Registro | O vínculo autoriza os objetos específicos: carteira/equipe/cobertura, matrícula, turma, encontro, avaliação ou atendimento? |
| Campo | A projeção contém apenas os dados necessários e permitidos naquele vínculo e finalidade? |
| Condição | Estado, vigência, autoria independente, versão aprovada e demais requisitos da operação continuam válidos? |

Conferir as quatro dimensões no servidor, inclusive em consultas por ID, arquivos, exportações, notificações e trabalhos posteriores. Ocultar controles da tela não substitui autorização. Acumular papéis não combina o escopo de um papel com os campos privilegiados de outro nem permite autoaprovação.

## Limites preservados

- Comercial: carteira individual, equipe explicitamente vinculada ou cobertura temporária vigente. Transferência não reatribui comissões históricas. Depois que a Secretaria assume, o vendedor solicita correções cadastrais/documentais.
- Secretaria: operação cadastral, contratual e acadêmica autorizada e informação financeira individual necessária ao atendimento. Registra comprovante; Financeiro confirma. O papel não concede caixa, despesas ou comissões por consequência.
- Professor: acesso pedagógico às atribuições vigentes e histórico das próprias aulas em leitura. Comunicação institucional, sem contato pessoal ou extrato financeiro. Designação específica de uma pendência não abre a turma inteira.
- Gestão Pedagógica: organização, aprovação independente e acompanhamento acadêmico. Estado operacional necessário não abre detalhes de dívida ou extrato financeiro.
- Financeiro: cobranças, pagadores, evidências e ajustes no alcance autorizado. Preparação, aprovação e execução conservam as separações específicas; comprovar crédito não comprova devolução.
- Administração: configurações e concessões sensíveis, além das substituições de aprovação previstas. Continua sujeita a autoria independente, versão válida e evidência.
- Aluno: dados próprios e materiais autorizados pela matrícula e pelo vínculo aplicável. Outro contrato ativo não libera conteúdo de contrato pausado, encerrado ou restrito.

Exportar exige concessão específica e não amplia registros ou campos. Contato ou telefone compartilhado não concede acesso a todos os atendimentos. Responsável financeiro não recebe permissão acadêmica automaticamente.

Pausa, retomada, encerramento, cobrança e acesso têm a matrícula como referência, conforme Q102 e sua SPEC. Calendário, turma e encontro podem ser compartilhados, mas a autorização do participante continua vinculada à contratação correta.

## Evidência de implementação

O [quadro único](planejamento/quadro-entregas.md) registra entregas e evidências atuais. Testes antigos são válidos apenas para o código e o recorte que verificaram. Esta reconstrução resolve a referência ausente; o original permanece não recuperado e nenhum requisito passa a ser considerado implementado por sua existência aqui.
