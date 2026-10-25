# Inbox #346 — badge, selo, prévia e chips da Aria

A lista apresenta o estado autorizado do DTO343 e os agregados do resumo344. Não consulta nem decide sugestões no cliente. Estados ia/aprovacao/handoff exibem selo IA e um único badge de estado antes dos demais; humano usa Com você, Com <primeiro nome> ou Humano, sem selo. Sem estado, os valores anteriores continuam iguais; grupos conservam ícone e ausência de badges. Setor, fila, nome ausente e prazo continuam sobrepostos. A fronteira visual de atraso30 min não foi alterada.

A prévia usa Aria:, Você:, <rótulo>: ou Aria sugere: <rótulo>, conforme previaAutor/previaRotulo. A sugestão substitui a prévia inteira por seu rótulo e nunca incorpora texto/payload da sugestão. Avatar e ItemConversa já ofereciam o selo19 px; seus runtimes permanecem iguais. O contrato existente seloIa e a assinatura estadoVisualItem(item, agora, usuarioId?) foram mantidos.

Com resumo, a coluna oferece sete chips nesta ordem: Todas, IA atendendo, Aprovação, Handoff, Humanos, Sem resposta e Não atribuídas. Os totais vêm exclusivamente de resumo.contagens, nunca do número de itens renderizados. Ativação prioriza aria, prazoEstourado, responsável fila e Todas. Cada chip limpa aria/prazo/fila; mantém responsável eu/ID explícito, naoLidas, setor, número, status e busca. Fila substitui o responsável ao ser escolhida. A URL usa o serializer puro existente. Os helpers/API legados de cinco chips continuam intactos e são fallback quando resumo está ausente; Minhas/Não lidas permanecem filtros por URL.

O SSR já fornecia resumo; #346 o mantém no estado e o passa à coluna. Somente o snapshot vigente da primeira página pode atualizar resumo e contagens: leitura pendente, versão/contexto antigo e navegação anterior não substituem o agregado conhecido. Falha conserva o último resumo; cursor não pede nem substitui agregados. O retorno de leitura dispara reconciliação fresca inclusive quando só há resumo. Mantidos SSE compartilhado, coalescimento e mensagem+aria.global no mesmo act, sem polling novo. page.tsx e backend344/345 não recebem alterações ou consultas adicionais.

D1/D2 e alçadas/edição/pacote seguem nas extensões354–356. #346 não altera cartão350, permissões, envio, compositor, schema ou dados. Base própria abb96162; união com os hunks328/350 cabe ao integrador.

Validação nominal e negativos: output/inbox-346-report.md. Aceite visual nas três larguras/dois temas, fixture e harness coordenados, QA independente e CI integrada ainda são obrigatórios; esta entrega de fonte não conclui a issue por presunção.

Checkpoint DEV: UNIT em dois executores separados (23 arquivos/347 casos e guarda de um arquivo/131 casos), mais lint12, com EXIT0. TSC original local interrompido por coordenação devido à pressão de memória observada; não houve aprovação local de tipo. CI/TSC remotos do commit exato, visual e QA permanecem pendentes conforme relatório.

## Revisão R1 da PR #431 (25/10/2026)

C1: com o resumo da Aria, filtros pessoais e prazo presentes na URL aparecem em etiquetas removíveis e entram no selo de filtros. O popover oferece Minhas conversas e Somente não lidas. Limpar remove setor/status e estes filtros adicionais, preservando número, busca e o estado Aria escolhido. O fallback sem resumo mantém o contrato anterior. Um responsável por ID aparece como Responsável selecionado, sem expor identificador ou inferir nome não recebido.

C4: sugestão sem rótulo usa Sugestão da Aria, inclusive para rótulo vazio, sem mostrar o preview bruto. Mensagem de pessoa sem rótulo usa o nome já autorizado no item, com fallback Contato.

C5: router.replace é intencional: mantém a navegação dos filtros legados e evita uma entrada de histórico por seleção de chip. Não altera o serializer nem apaga filtros pessoais ao escolher Todas. C6: seloIa continua o nome usado pelo Avatar. A rastreabilidade nominal do plano é: badge_de_estado_da_aria_vem_primeiro_e_e_unico corresponde aos três casos parametrizados estado %s vem primeiro; previa_de_sugestao_mostra_so_o_rotulo corresponde a prévia só projeta autor/rótulo autorizado; ordem_rotulos_tons_e_totais corresponde a sete chips têm ordem, rótulo, tom e agregado exatos; chips_sao_exclusivos_e_preservam_os_outros_filtros corresponde a só limpa dimensões Aria/prazo/fila, preservando eu/ID/naoLidas e demais filtros. Nenhum caso foi omitido por divergência editorial.

Os dois novos controles são seletores de filtro, sem ação de negócio; seus nomes exatos foram adicionados ao inventário fechado da guarda de botões, mantendo os detectores. B1/C3 (composição) e C2 (visual) permanecem gates do integrador; nenhuma issue foi concluída aqui.
### R2 PR431: Limpar preserva chips e fallback de autoria

Filtros representados pelos chips Sem resposta (prazoEstourado) e Não atribuídas (responsavel=fila) não são duplicados em etiquetas/selo. Limpar nas etiquetas e no popover preserva esses chips e aria, removendo somente setor/status e filtros pessoais eu/ID/naoLidas no modo com resumo. Busca/número e modo legado continuam preservados. A prévia de saída pessoa sem rótulo usa Equipe:; nunca atribui mensagem da equipe ao nome do contato. Testes reais da coluna cobrem os três chips, os dois Limpar, ausência de etiquetas/selo duplicados e preservação de contexto. Revisão5643199383 C1/C2 atendida; evidências no report, sem novo comportamento servidor.
