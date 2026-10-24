# Inbox #326 — edição do contato na composição325 (D14)

Estado: composição DEV estática revisável, com integração, nova prova Save/visual e QA pendentes. Base `d775a140b824e56307d50d95d7bb0ad5284a5f6e`; não há schema, dependência ou fonte327/328 nesta entrega.

O lápis de PainelContato abre uma única gaveta Editar contato somente com Pessoa resolvida, capacidade editarContato e ações disponíveis no contexto comercial. Detalhes/B2B325 e links autorizados336 permanecem. A mesma instância `useAbaPainel` fica ativa para Detalhes OU editor, sem segunda aquisição, SSE ou polling. O snapshot inicial e a Pessoa esperada pertencem à abertura; revalidação não troca o alvo nem apaga rascunho.

A gaveta usa Drawer existente: largura total abaixo de700px e348px a partir desse corte. Seis básicos (nome, e-mail, cidade, cargo, LinkedIn, origem) e cinco tipos personalizados (texto, número com step=any, data, seleção, booleano). Empresa é somente leitura; ficha completa exige verContato. Telefone, empresaId, documento/nascimento340 e alternância B2C/B2B ficam fora do editor. Salvar permanece desabilitado sem diff, preserva zero/false e bloqueia duplicação enquanto ocupado. Erro ou transporte incerto conserva o texto. Cancelar/reabrir ou trocar atendimento cria nova sessão; ACK antigo não fecha nem reconcilia a sessão atual.

`editarContatoNoInbox(atendimentoId, { pessoaIdEsperada, pessoa?, campos? })` resolve o alvo autorizado no servidor. A identidade esperada é CAS da leitura, nunca autorização nem alvo de WHERE. Schema estrito recusa empresaId, campos duplicados e valores inválidos. Após lock, revalida ator ativo, papéis/permissões, contexto, identidade e escopo usando a mesma transação. Pessoa, campos, Eventos e aviso/NOTIFY são atômicos; no-op não cria Evento/aviso. Núcleos CRM mantêm suas actions públicas, validadores, escopos Pessoa/Empresa e assinatura Resultado, inclusive com pool1.

O foco original2de9 é preservado após resize/fechamento, com fallback apenas quando o controle restaurado está oculto ou inert. Retrybec9 entrega foco ao Fechar persistente antes de remover o próprio botão. O painel conserva a montagem e deixa de anunciar outro modal durante a gaveta.

## Evidência e pendências

Porte de16 pathsSRC de09498, excluindo hook/teste já idênticos; foco2de9 acrescenta o teste de foco, total17 arquivos de código/testes. Retrybec9 foi aplicado uma vez. Conflitos de InboxNovo foram resolvidos por hunk, preservando os dados325. Nenhum arquivo de scripts/visual foi alterado; ownership continua A327.

Gates atuais: recorte integral74 arquivos/700 testes em36669/655668 (20,87s, dois workers, sem filtro de nome/skips impostos); TSC30703/c2b8d7 (--noEmit --incremental false, heap8192); lint17 a85cb1/zeroavisos, todos saída0. O primeiro recorte698/700 falhou apenas por mock antigo de ícones incompleto, corrigido sem remover asserções. Detalhes em output/inbox-326-report.md.

Integração só após confirmar lease/cliente com ROOT. A execução Save2588/2bca76 continua EXIT1; seus dois POSTs pontualmente bem-sucedidos não provam os dois aborts sem cronologia. As39 imagens/13pranchas históricas são nominais bec9/a540, não desta composição. Plano privado propõe uma Save nova, ACK original retido e observador por fase/versão, sem afrouxar coletor325. Nenhuma nova UI, HTTP local, fixture ou Save foi executada. Visual, QA independente, composição/CI/publicação permanecem pendentes; não concluir a issue.
