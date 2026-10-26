# QA DEV #361 — nova conversa pelo fluxo atual

Status: entrega DEV em validação; fechamento autoritativo ao final. Base b37fa9691277875a3ae5adf5f5f24e9425032985; branch codex/inbox-e4-361-nova-conversa. Delta somente UI; #372/D9 por número novo indisponível nesta entrega. Sem SQL/servidor/browser/integrações externas.

## Evidências terminais

- 8bf9b4 EXIT1: primeiro14 tinha seis falhas de fixture SVG createElementNS; não atribuir essas ao produto.
- 8b07a5 EXIT1: scaffold neutro importável,14=13falhas/1controle; ausência de busca/UI/canais. Log red-assertivo preservado.
- d07e47 EXIT1:13/14pass, único erro fixture select.options; ajuste somente no DOM mínimo do teste.
- 4d593f EXIT0:2arquivos14casos.
- 5a404b EXIT1:3arquivos23=22pass/1fail; ACK após opções A→revogada→A selecionava antigo.
- a2a99a EXIT0:3arquivos23casos; geração monotônica local impede ACK antigo, unmount e busy cobertos.
- 94207b EXIT1:3arquivos28=26pass/2fail; handler retido revogado chamava servidor e callback de conversa navegava durante busy.
- 8f7b5b EXIT0:3arquivos28casos, após guarda vigente antes do dispatch e ref busy síncrona. RED SHA372ebc180c5f29f17e000014cf4e7ea8a0c1511a91ca7243a8470736dba0db3e; GREEN SHA45b07ced1665584200ee57f905e198a333e23258da9e0e50179bf955fdc354de.

Todos completos, sem filtros de caso/skips, vitest.config original, Node local heap1024, maxWorkers1, UTC e sete providers vazios no executor. Não são suíte global. Nenhum executor desacoplado; comandos retornaram terminal diretamente, sem session_id pendente.

## Portabilidade e preservação

Os comportamentos do formulário removido foram portados: sem carteira não é sem canal; papel sem escopo; destinos sem canais; comercial não usa institucional; canal múltiplo exige escolha; chave de retry/duplo clique/ACKs. Apresentação antiga de selects permanentes/moldura não é mantida porque #361 troca por busca e resultados. Testes novos usam ReactDOM e PopoverColuna/useDialogo reais, somente action servidor mockada na fronteira. Avatar/SVG não é mockado; DOM mínimo fornece createElementNS/options.

InboxNovo muda import e conteúdo da prop novaConversa, com key de atendimento para desmontar abertura ao trocar conversa. Coluna/diálogo/foco/Header/servidor/schema/client/distribuição/escopo não alterados. page.test remove mock do componente apagado. Mapas declarativos de botões/estados vazios substituem path antigo pelo novo; parser/guardas não alterados.

## Pendências históricas antes do fechamento abaixo

29º controle de chaves por alvo preparado; aguarda RED→helper canônico→GREEN. Consumidores InboxNovo/Coluna/page, guardas completas e lint ainda NÃO executados na nova fonte integrada. Visual/mobile/claro/escuro e QA independente pendentes; sem homologação presumida. Não commit/freeze final até completar checks coordenados. #372 exige implementação separada/backend/schema/reserva ROOT; não há nova Pessoa/op/envio ou saudação.

## Fechamento DEV — resultados autoritativos e limites

- RED29 491eca EXIT1 (28pass/1fail chave compartilhada entre alvos) → useChavesPorAlvo canônico → GREEN974467 EXIT0 3/29. Retry do mesmo destino/canal mantém chave; outro alvo não fica preso à tentativa anterior.
- Consumidores completos S69451/1d06c2 EXIT0:9arquivos237casos. O primeiro S29658/8657fb EXIT1 (236pass/1fail) exigia formulário antigo; portado para busca única e zero forms iniciais, preservando diálogo único/CtrlK/foco. Esse replay antecede o ajuste de lint do token descrito abaixo; não é evidência de global no freeze final.
- Guardas completas S96412/170188 EXIT1:264pass/2fail, sendo novo registro nominal361 e carry447 herdado. ROOT autorizou carry literal de aoTransferirConcluido para mensagem constante Transferência concluída.; não é correção361 e já existe na publicação Root4d8c7512. Publicação ROOT absorve esse hunk sem duplicação.
- Lint inicial2bad20 EXIT1:refs lidas durante render e children explícito em createElement. Corrigido por token Symbol/contexto via useMemo publicado em useLayoutEffect; refs apenas nos handlers/effect. Fixture usa terceiro argumento children e tipo das props do casco, sem alterar componente compartilhado. GREEN3a418f29 (histórico sem os sete blanks explícitos; só unit sem providers). Final abaixo repetiu com todos os sete blanks.
- Guardas S81769/21215c EXIT1:266pass/1fail era o novo mutante atingindo Avatar antes do texto. Corrigido controle para <span> do nome visível, sem parser/política alterados. Final S32971/bdf07e EXIT0:6arquivos267casos, sem filtro: Botões93/Campos/EstadosVazios/FormuláriosPreservados/FeedbackSeparado/PaginaçãoDoisSentidos. Dois registros nominais Conversa1/Contato1 com motivos; mapas exatos e negativos de nomes vazios, variante, rótulo e botão extra.
- Focal final e lint em série S15281/adad48 EXIT0:3arquivos29casos (stdout efe811), depois lint completo dos11paths SRC restantes alterados, zero erros/avisos. Tee de stdout vazio pode não gerar arquivo de lint; terminal é o recibo, sem hash de arquivo inexistente. Todos completos/configoriginal/UTC/w1heap1024/7blank, sem skips/filtros de caso.

Hashes logs: consumidores57427081999ba008b405f3990e8ec7aa01772348d434dc8b9be19a8de59cb5b9; guardas601a17b41b97c9fcb2dac7a04b71c946264d13bd3922793614950ae1a7d2a49f; focalfinalbb6d70cace50c36d28c4bd7d38721e0ca1a83a44d3eccd042a915cd48330ab99.

NodeB/SQL liberados; ROOT segurou nova execução. TSC/global/CI/build/visual/QA independente pendentes. Sem banco solicitado ou escrito. Base schema/client496 preservada, Grant370 inativo. Entrega apenas #361, nenhuma disponibilidade D9/#372 anunciada.
