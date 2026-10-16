# Funções do Inbox — lista oficial (aprovada em 15/10/2026)

Referência única para o motor (roteiro de adaptação, no repositório `whatsapp-web-baileys`), o ERP (`modelo-atendimento-crm-erp.md`) e a análise da UI final.

**Contexto:** no app original, cada pessoa usa o próprio WhatsApp. No CRM, **vários atendentes usam o mesmo número da escola**. Nenhuma funcionalidade é retirada por causa do visual: o que sai do motor são só os arquivos visuais derivados do WhatsApp Desktop (cores, logo, ícones, papel de parede). Botões e ações continuam, com o design system do produto.

## Princípios

1. **Conversar com o cliente** fica igual ao app original, para todos os atendentes.
2. **Organização da lista é pessoal** (de cada atendente), não do número. Não sincroniza com o WhatsApp.
3. **O que muda a identidade ou o histórico do número** fica com o Admin (ou gerentes, quando indicado), sempre com registro (`Evento`) de quem fez.

## Tabela

| Função | Quem usa | Regra | Onde mora |
|---|---|---|---|
| Texto, emoji, GIF, figurinha, reação, voz, foto, vídeo, documento, enquete, localização, contato, responder, busca, galeria | Todos com acesso à conversa | Igual ao app original | Motor (protocolo) + ERP (permissão) |
| Editar e apagar para todos | Todos | **Só as próprias mensagens**; grava `Evento` | Motor + ERP |
| Encaminhar | Todos | **Só para conversas que a pessoa pode ver**; segue escopo e opt-out | ERP valida, motor envia |
| Favoritar mensagem | Todos | **Pessoal**, não sincroniza com o WhatsApp | ERP |
| Fixar, marcar como não lida, silenciar | Todos | **Pessoal**, não sincroniza com o WhatsApp | ERP |
| Arquivar | — | Substituído por **encerrar atendimento** | ERP |
| "Digitando..." | Automático | Enviado enquanto o atendente digita | Motor |
| Confirmação de leitura | Automático | Abrir a conversa marca como lida no WhatsApp | Motor |
| Cartão Pix e botões de mensagens comerciais | Todos | Exibir e responder | Motor |
| Chamadas recebidas | Automático | Viram **"chamada perdida"** na conversa; ligar continua fora | Motor (evento) + ERP |
| Grupos: ver e enviar | Quem tem acesso ao grupo | Ex.: professor no grupo da turma | ERP (escopo) + motor |
| Grupos: criar, adicionar e remover pessoas | Admin, gerentes e Secretaria | Grava `Evento` | ERP valida, motor executa |
| Bloquear contato | Admin e gerentes | **Motivo obrigatório**; grava `Evento` | ERP valida, motor executa |
| Foto, nome, recado e privacidade do número | Só Admin | Em Configurações › Números | ERP valida, motor executa |
| Mensagens temporárias | Só Admin | **Desligado por padrão** (preserva histórico e auditoria) | ERP valida, motor executa |
| Apagar contato da agenda do WhatsApp | — | **Não existe**; a agenda é a tela de Contatos do CRM | — |
| Status | Admin ou marketing | **2ª versão** | Motor (código guardado) |
| Canais e Comunidades | — | **Fora** (código guardado no motor) | — |
| Conversas trancadas e listas pessoais | — | **Fora**; substituídas por permissões por setor e filtros salvos | — |
| Aria (IA) | IA | **Só texto e documentos da base de conhecimento**; sem figurinha ou GIF; não edita nem apaga | ERP |

## Consequências técnicas

**Motor (modo serviço) precisa expor:**
- envio de todos os tipos da linha 1 (inclui figurinha, GIF, enquete, localização, contato);
- editar, apagar para todos, reagir, encaminhar, votar em enquete, resposta a botão comercial;
- marcar como lida e "digitando";
- eventos de chamada recebida;
- grupos: listar, detalhes, enviar, criar, participantes;
- bloquear e desbloquear contato;
- perfil do número (foto, nome, recado), privacidade, mensagens temporárias;
- catálogo de GIFs e **biblioteca de figurinhas da escola** (compartilhada pela equipe; hoje é por conta).

**Motor não expõe (fica no código, desligado):** Status (volta na 2ª versão), Canais, Comunidades, conversas trancadas, listas pessoais, arquivar/fixar/silenciar/não lida/favoritar no protocolo, apagar contato.

**ERP precisa:**
- guardar fixar, não lida, silenciar e favoritos **por usuário**;
- validar "só as próprias mensagens" para editar e apagar;
- validar o escopo do destino ao encaminhar;
- restringir por papel: grupos (criar e participantes), bloquear, perfil, privacidade, temporárias;
- gravar `Evento` para editar, apagar, bloquear, mudanças de grupo e de perfil do número.
