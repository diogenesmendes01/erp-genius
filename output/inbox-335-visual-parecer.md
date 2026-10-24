# #335 — parecer visual do DEV

Fonte APP: `4c76d200257ea4c3df3707e95100d9180a9efdbc`. Fonte harness: `6e498f867378b0489983eb11c57b664366ca408c`. Preview do ROOT: sessão 79643; Node 22.23.2, cliente/schema 487. A fixture suplementar foi preparada pelo ROOT em ac3894: 11 linhas novas, incluindo cinco de catálogo privado porque o catálogo original estava vazio. Os dados originais307/314 foram preservados; não executei seed/SQL/Prisma.

## Evidência positiva

64 PNGs originais, 4.273.828 bytes, inspecionados offline:

- 24 formais APP: origem Secretaria, destino matrícula, origem Funil e destino Contato, nos três tamanhos e dois temas. As seis origens Secretaria vieram da CLI R2; 17 das outras 18 fotos vieram da navegação R1; uma foto do destino foi substituída pela recaptura independente após fechar as preferências oficiais do Next.
- 16 de permissões: Secretaria vê matrícula/código e chega ao destino; Professor convidado lê o atendimento mas recebe id/código/documentos nulos e envio false. O navegador chega realmente a `/acesso-negado` ao tentar a matrícula diretamente, sem ficha. Não se inferiu redirect por HTTP200 de stream.
- 24 de alcance: oito contextos em 320/390/1024/1440 × 500 px, dois temas, cada qual com posição inicial, link alcançado por Tab e último controle alcançado. Os controles não foram acionados. Escape retornou ao gatilho e reabrir/resize conservaram o mesmo link na mesma conversa. Doze medidas adicionais nas bordas699/700/959/960/1399/1400 confirmaram alcance e identidade nos dois temas.

Os cliques e Enter reais chegaram a `/matriculas/inbox-335-matricula-lucas`, mostrando código MAT-INBOX-335, aluno e produto fictícios reais, e a `/contatos?c=inbox-demo-pessoa-mariana-307`, mostrando Mariana Costa. Não foi usado sucesso interceptado, JSON de permissão fabricado ou HTML de cadastro falso.

A tabela `output/inbox-335-app-prototipo.json` tem 12 linhas (dois trajetos × três tamanhos × dois temas). Protótipo funcional N/A: a referência não possui navegação real nem ACL desses cadastros. Nenhuma imagem protótipo foi inventada. O encoder hrefConversa não ganhou um consumidor de tela nesta issue; sua prova é unitária, e o produtor de navegação da336 continua separado.

## Inspeção e limites

Os originais foram vistos nas dez pranchas privadas `output/inbox-335-inspecao/prancha-01.jpg` até `prancha-10.jpg` e nas sete `output/inbox-335-inspecao-alcance/prancha-01.jpg` até `prancha-07.jpg`. Essas pranchas são instrumentos derivados, não os originais da allowlist. Uma delas conserva a imagem negativa Next para rastreabilidade; não copiar pastas inteiras para pacote positivo.

O link móvel fica em y482,5–499,5 após Tab, com 17px de altura: íntegro, próximo à borda inferior de500, sem margem ampla. A posição inicial mostra conteúdo inferior ainda fora da janela; isso é distinto de alcançar por rolagem local. O último botão ficou íntegro em431,5–475,5 no móvel e449,5–475,5 no desktop/tablet. Documento do Inbox permaneceu em scrollY0. O cabeçalho pode sair da janela quando se rola intencionalmente até o último controle. Não estendi essa regra de rolagem ao ERP global nos destinos.

Aguardar a conclusão do corpo GETmensagens foi necessário na thread deliberadamente vazia; o painel autorizado e seu link real já estavam prontos. O harness reutiliza o observador finito existente, sem suprimir ERR_ABORTED, alterar produção ou criar mensagens. Nas18 origens de navegação, houve duas construções SSE sequenciais, máximo uma simultânea/uma ativa. Não alegar uma construção total.

A interface oficial Next Preferences/Hide foi usada; a recaptura espera Hide desaparecer. Console/rede/React continuaram sendo observados. Navegação:18/18 contextos sem pageerror/React/HTTP inesperado/tráfego externo; alcance:8/8 sem essas falhas. Nenhum Enviar/Assumir/Aria/nota/ativação/financeiro foi acionado.

## Negativos preservados, fora das allowlists

1. `output/inbox-335-formal-r1`: seis imagens da CLI antiga86f, rodada terminal1 por um GETmensagens abortado sem substituto concluído antes da foto. Cinco imagens sem falha isolada não fecham aceite dessa rodada.
2. `output/inbox-335-alcance-r1`: uma imagem inicial, rodada terminal1 porque o probe usou o nome acessível errado do botão responsivo. Corrigido só no probe privado para Voltar para a conversa/Fechar painel; sem mudança do app.
3. `output/inbox-335-navegacao-r1/admin-escuro-desktop-destino-matricula.png`: resultado de navegação correto, mas foto mostrava Preferences do Next ainda fechando. Excluída e substituída por `output/inbox-335-alcance-r2/admin-escuro-desktop-destino-matricula-r2.png`.

## Fontes, execuções e ambiente

- CLI R2: sessão70259, terminal2428c9/0, seis capturas.
- Navegação: sessão6278, terminal5da4d1/0,18 contextos/34 fotos, uma excluída visualmente.
- Alcance R2/recaptura: sessão59355, terminal320fe6/0, oito contextos/25 fotos.
- Todos os contextos/browsers foram fechados antes do handoff. ROOT parou79643 em e77752 (Ctrl+C/1 esperado, não gate) e restaurou A487 em c538fc/0:424 hashes/9 mensagens/4 notas, snapshot323 mantido e11 linhas privadas removidas. São operações externas do integrador.
- BlocoNext de dez linhas em AGENTS foi conferido97c7d8 e removido sozinho563acc; instruções originais preservadas. Identidade da produção contra4c76 confirmada563acc/0.

As allowlists nominalmente identificadas são `output/inbox-335-formal-allowlist.json` e `output/inbox-335-complemento-allowlist.json`. Só os arquivos nelas, após conferir hash/bytes, são candidatos ao pacote positivo. Não versionar PNG, credenciais, manifests brutos ou probes. QA independente do freeze, integração/global, publicação e CI ainda pendem; este parecer não conclui a issue por conta própria.