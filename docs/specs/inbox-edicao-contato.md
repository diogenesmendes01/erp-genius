# Inbox #326 — edição do contato na composição325 (D14)

Estado atual: composição para PR em rascunho, diretamente sobre a main `ae56c00f053e864a3efea35d2f640afe48716cc4`. Código e QA independente verificados; nova prova de Salvar pela interface e aceite visual ainda pendentes. Não há alteração de schema, dependência ou fonte das issues #327/#328 nesta entrega. As seções abaixo preservam a cronologia e a fonte de cada evidência.

O lápis de PainelContato abre uma única gaveta Editar contato somente com Pessoa resolvida, capacidade editarContato e ações disponíveis no contexto comercial. Detalhes/B2B325 e links autorizados336 permanecem. A mesma instância `useAbaPainel` fica ativa para Detalhes OU editor, sem segunda aquisição, SSE ou polling. O snapshot inicial e a Pessoa esperada pertencem à abertura; revalidação não troca o alvo nem apaga rascunho.

A gaveta usa Drawer existente: largura total abaixo de700px e348px a partir desse corte. Seis básicos (nome, e-mail, cidade, cargo, LinkedIn, origem) e cinco tipos personalizados (texto, número com step=any, data, seleção, booleano). Empresa é somente leitura; ficha completa exige verContato. Telefone, empresaId, documento/nascimento340 e alternância B2C/B2B ficam fora do editor. Salvar permanece desabilitado sem diff, preserva zero/false e bloqueia duplicação enquanto ocupado. Erro ou transporte incerto conserva o texto. Cancelar/reabrir ou trocar atendimento cria nova sessão; ACK antigo não fecha nem reconcilia a sessão atual.

`editarContatoNoInbox(atendimentoId, { pessoaIdEsperada, pessoa?, campos? })` resolve o alvo autorizado no servidor. A identidade esperada é CAS da leitura, nunca autorização nem alvo de WHERE. Schema estrito recusa empresaId, campos duplicados e valores inválidos. Após lock, revalida ator ativo, papéis/permissões, contexto, identidade e escopo usando a mesma transação. Pessoa, campos, Eventos e aviso/NOTIFY são atômicos; no-op não cria Evento/aviso. Núcleos CRM mantêm suas actions públicas, validadores, escopos Pessoa/Empresa e assinatura Resultado, inclusive com pool1.

O foco original2de9 é preservado após resize/fechamento, com fallback apenas quando o controle restaurado está oculto ou inert. Retrybec9 entrega foco ao Fechar persistente antes de remover o próprio botão. O painel conserva a montagem e deixa de anunciar outro modal durante a gaveta.

## Evidência e pendências

Porte de16 pathsSRC de09498, excluindo hook/teste já idênticos; foco2de9 acrescenta o teste de foco, total17 arquivos de código/testes. Retrybec9 foi aplicado uma vez. Conflitos de InboxNovo foram resolvidos por hunk, preservando os dados325. Nenhum arquivo de scripts/visual foi alterado; ownership continua A327.

Gates atuais: recorte integral74 arquivos/700 testes em36669/655668 (20,87s, dois workers, sem filtro de nome/skips impostos); TSC30703/c2b8d7 (--noEmit --incremental false, heap8192); lint17 a85cb1/zeroavisos, todos saída0. O primeiro recorte698/700 falhou apenas por mock antigo de ícones incompleto, corrigido sem remover asserções. Detalhes em output/inbox-326-report.md.

Integração só após confirmar lease/cliente com ROOT. A execução Save2588/2bca76 continua EXIT1; seus dois POSTs pontualmente bem-sucedidos não provam os dois aborts sem cronologia. As39 imagens/13pranchas históricas são nominais bec9/a540, não desta composição. Plano privado propõe uma Save nova, ACK original retido e observador por fase/versão, sem afrouxar coletor325. Nenhuma nova UI, HTTP local, fixture ou Save foi executada. Visual, QA independente, composição/CI/publicação permanecem pendentes; não concluir a issue.

## Verificação posterior do freeze2b43

INT27437/37989e: quatro arquivos completos/44 testes,191,96 s,perfilci-integracao487/um worker,EXIT0,nominal ao produto2b43. Global inicial63868/10d9c0 ficou negativo por um falso positivo: enum mapeado ao atributo nativo input.type foi tratado como rótulo. Correção separada somente na trava, por contexto direto e folhas literais técnicas number/date/text, sem exceção por arquivo/nome; sete contextos negativos permanecem detectados.

RED138 com duas falhas causais → GREEN138 completo22e1db; guardas5/166b15d9a,TSCebb842 e lint0d33d0 terminaram0. Global final31619/1192b5:928 arquivos/7.335 testes,254,29 s,dois workers,sem filtro de nome ou skips impostos,EXIT0. APP/servidor e os17 paths da composição continuam idênticos2b43; INT não foi repetida por mudança exclusiva na trava. B1/C1 da revisão325, nova prova Save/visual, QA de composição, CI e publicação continuam pendentes.

## Produtor R1 de325 composto

Delta mínimo29b23763→fd1ea: hook/teste e teste de Detalhes, mais uma condição de fallback WhatsApp. Cache por atendimento/aba conserva o DTO bom em revalidação/retry/falha transitória; troca/desativação limpa imediatamente e403/404 revogam. Editor326 mantém sua sessão/snapshot e a mesma instância Detalhes OU editor. Fallback de telefone depende de ausência de Pessoa confirmada, sem ampliar permissões/setor. Só uma aba Detalhes nesta fonte; sem327/328 ou harness portado.

Recorte12906/8d9440:74 arquivos/711 testes,24,37 s; TSC31135/9afe00 e lint4 73db59, todosEXIT0. Harness96c+enums73287/86353d:18/288,32,16 s,EXIT0; sem filtro de nome/skips impostos. Backend idêntico2b43, mantendo4/44INT nominal, sem repetição. QA da composição, nova prova Save/visual, fixture/observador privados e publicação continuam pendentes.

## Publicação direta sobre a main

A composição `8b91bab362416ba3dd42a99831d5898356e99479` preserva os 21 blobs SRC selecionados do freeze DEV `6f92673dfb526e11ad1e349bea484d135819e849`, conferidos pelo ROOT (42004/48d232) e pelo TESTER (74031/dade9b). O diff efetivo contra a main contém 18 arquivos SRC e três documentos; o quadro foi composto preservando os dois lados. Os relatórios de QA acrescentados depois não alteram o código.

Gates ROOT com saída terminal 0: global 4382/ccacc3, 928 arquivos e 7.346 testes, 247,36 s, dois workers, sem filtro de nome ou skips impostos; TypeScript 64248/ae29c1; lint global 96352/cdae87, zero erros e 40 avisos herdados. A configuração unitária exclui integração. QA independente do conjunto: 24 arquivos e 656 testes, TypeScript e lint de 21 fontes com saída 0. Os três pareceres integrais estão em `output/inbox-326-qa/indice.json`; seus recortes se sobrepõem e não devem ser somados. A integração de quatro arquivos/44 testes continua nominal ao backend 2b43, cuja identidade foi conferida.

Preparação local nova executada pelo integrador: inspeção 4967db e aplicação f14779 com saída 0, 18 registros fictícios suplementares, total de 516; 498 registros originais, hashes das 424 tabelas e sequências preservados. Número desconectado e provedores externos vazios. O preflight HTTP confirmou Painel, Detalhes e HTML com status 200, permissão de editar e envio desabilitado. A preparação não executou Salvar pela interface.

A PR permanece em rascunho até concluir uma persistência real controlada, prova de ACK antigo/SSE, fechamento e restauração do banco e QA visual. O histórico 2588/2bca76 continua negativo; as 39 imagens antigas não são reatribuídas à composição atual. Não concluir a issue com essas pendências.
