# Nova conversa — fluxo existente (#361)

Estado: implementação DEV verificada por focais e guardas; QA independente e visual pendentes. Base DEV b37fa9691277875a3ae5adf5f5f24e9425032985; publicação somente delta361, nunca pais privados.

## Contrato

O gatilho Nova conversa da coluna abre um único diálogo canônico, com campo Nome ou número com DDD. A busca é local, somente sobre conversas já carregadas e destinos autorizados de OpcoesAtendimento. Sem termo: até oito conversas mais recentes e doze destinos; busca ignora caixa/acentos. Telefone só usa contatoTelefone que já veio autorizado; a partir de três dígitos. Não consultar nem revelar cadastros adicionais.

Conversa existente seleciona o atendimento sem action. Destino disponível utiliza abrirAtendimentoInstitucional e as chaves canônicas por alvo (destino + canal). Um canal elegível permite abertura; vários exigem seleção explícita. Comercial filtra numeros.comercial; demais finalidades preservam canais históricos. Destino indisponível informa impedimento e não executa. Nenhum canal elegível não usa fallback.

Falha mantém feedback no diálogo e a mesma tentativa para retry. Apenas ACK de sucesso da abertura/identidade ainda vigente seleciona o atendimento; troca de destino/capacidade/desmontagem não permite navegação por ACK antigo. Busy bloqueia duplo clique/submissão. Preservar retorno de foco/ESC pelo useDialogo existente, sem diálogo aninhado.

Estados vazios distinguem vendedor sem lead, usuário sem destinatário, destino sem canal e comercial sem linha. Número não encontrado oferece orientação de cadastro atual. Não oferecer Conversar com número nem anunciar D9 disponível.

## Fora desta issue

#372 é dependência obrigatória da entrega de D9: número novo, busca servidor, Pessoa/oportunidade/origem, migration e saudação editável. #361 não altera schema, CRM/carteira, permissões, kernel de abertura, grants370, Header, dispatchers ou APIs de envio. Nenhum envio automático, Intencao, novo polling ou SSE.

## Validação planejada

RED assertivo antes da produção; helper busca/canais; DOM real com PopoverColuna/useDialogo, API mock somente fronteira servidor. Portar contratos dos testes NovoAtendimento e acrescentar busy/ACK obsoleto/troca de contexto/teclado. Testar consumidores InboxNovo/Coluna, mapas nominais e guardas pertinentes em janela coordenada, lint dos paths. Sem SQL para delta somente UI/kernel literal. Visual nova-conversa/busca/número/mobile pelo integrador posteriormente; não homologado por unit.
# Integração ROOT R23

O delta DEV02aab2f3 foi integrado isoladamente sobre43913c11; reversão de todo o src recupera a base exatamente. Recorte ROOT123 arquivos/1.583 testes e lint11 passaram, sem backend/schema/configurações ou ancestrais privados. As evidências e limites estão em [QA da integração](../qa/inbox-361-integracao-r23-root.md). Esse recorte não substitui os gates globais, a execução independente e o aceite visual pendentes.
