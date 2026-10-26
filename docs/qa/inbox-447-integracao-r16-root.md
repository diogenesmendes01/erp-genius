# PR447 — integração C1/C2 sobre a composição com carga

Base ROOT `43d7563f` (SRC371 já validado independentemente); delta de revisão `2770e817`. Somente o delta foi aplicado, sem seus pais privados. Três conflitos em ConversaAberta e dois consumidores foram resolvidos preservando a ponte de Insights, as duas asserções de aba e o controle anterior de destinos opcionais.

No runtime de ConversaAberta, sete transformações locais acrescentam o callback de confirmação e usam `status === ENCERRADO` na identidade. A reversão exata dessas sete transformações recupera o arquivo anterior inteiro, incluindo Insights. InboxNovo mantém MensagemStatus fora da seleção e anuncia somente o ACK válido da abertura atual. Hooks, controlador e testes das quatro mensagens mantêm a autoria da candidata DEV. Não houve mudança de schema, backend, ACL, Header ou PopoverFluxo.

O recorte completo da pasta de transferência mais os dois consumidores passou em oito arquivos/183 casos (8dcde6, EXIT0), UTC/w1/heap1536, sem filtros ou skips, sete provedores vazios. ESLint dos oito SRC alterados: 43142/9db96e, EXIT0, sem saída. A suite global e o build anteriores pertencem à fonte817; precisam de nova execução para esta composição.

Negativos de integração preservados: e07ef2 terminou com uma falha/182 controles porque o controle legado procurava o formulário no host, enquanto agora se usa o portal real em document.body; a asserção foi direcionada ao diálogo real, mantendo o formulário obrigatório. 8a6721 passou 183/183 na versão com escolha de pessoa. Para o backport independente da371, o caso de inbound passou a exercitar transferência setorial, usando o seletor já existente nas bases e contexto com mais de12 caracteres. O primeiro recorte dessa versão (196254) falhou em quatro casos pela ausência de select.options no DOM mínimo; a fixture recebeu o mesmo suporte usado nos dois testes existentes de transferência, sem alterar produto ou asserções. 8dcde6 é o GREEN final dessa versão.

O teste final mantém contexto e chave após AGUARDANDO_CLIENTE→EM_ATENDIMENTO, aceita apenas a confirmação corrente e continua invalidando após mudança de responsável, encerramento ou perda de capacidade. Os casos de erro, resultado incerto, ACK antigo e desmontagem mantêm os controles negativos. O aceite visual, incluindo639/640/767/768px, continua pendente; DOM mínimo não comprova geometria de navegador.

## Publicação anterior preservada

A onda817 passou nos quatro gates originais: UNIT1.051/9.137 (56547/ae3939), TypeScript (23750/a512db), lint zero erros/65 avisos locais (96758/b61830) e build115 páginas (6612/6d4a76), todos EXIT0. Build iHXOQHrUTi0EUfUmM79sB. Quatro branches de PR foram atualizadas e duas criadas por push atômico sem force (23828/de6763); metadados444–447 atualizados, PR448 para369 e PR449 para377 criadas e anexadas. SRC/schema/configs da449 são literais817; auditoria independente da pilha favorável. Nenhum merge em main ou fechamento de issue nesta publicação.

Antes desta integração, o bundle817 foi arquivado fisicamente (44104c, EXIT0), com manifesto e234 assets verificados. Ele não é um build da fonte desta revisão. O TESTER executou SQL371 em43d:11casos, regressão2 e oráculos2, todos EXIT0; ROOT restaurou o banco493/425/1394 depois (31939b, EXIT0). Sem nova lease ou homologação presumida.
