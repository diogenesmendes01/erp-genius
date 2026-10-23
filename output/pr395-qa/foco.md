# PR #395 — C1 e C3

C1: a issue #308 recebeu adendo canônico que substitui os limites do pseudocódigo
pelos cortes finais 960/1400 px, preservando Sidebar 224 px e lista 300/372 px.
A SPEC contém a matriz de largura útil; o protótipo original não foi alterado.

C3: a origem de Registrar opt-out era desabilitada antes de o Modal capturar
activeElement. Agora permanece habilitada, com aria-haspopup/aria-expanded;
o fundo inert existente já impede interação enquanto o diálogo está aberto.
Nenhuma alteração no helper useDialogo ou em regra de negócio.

TDD: 2 falhas na fonte original; após correção, 6 arquivos / 33 testes passam,
sem filtros/ignorados. React DOM real com DOM mínimo verifica o gatilho, foco
inicial, isolamento, Voltar/Escape e ausência de execução da action. Limite:
o DOM mínimo não simula a perda nativa de foco ao desabilitar um botão.

Chrome headless real confirma 12/12 contextos: Voltar e Escape em 1440/1024/390,
claro/escuro. Foco inicial no botão seguro, origem inert, retorno à origem e
painel preservado em todos. Ação não confirmada; consulta posterior encontrou
7 contatos fictícios e nenhum opt-out ativo no ci-integracao. JSON anexo.
Duas tentativas anteriores em 127.0.0.1 expiraram esperando conteúdo, antes do
diálogo; logs privados preservados. A rodada final usou localhost, conta QA
administradora, somente fixture fictícia e transporte BAILEYS desconectado.

Gates saída 0: recorte unitário, TypeScript 52955 e lint dos dois arquivos TS.
Preview 9880 encerrado com Ctrl-C após a prova; bloco AGENTS gerado pelo Next
removido e original comparado com backup. Não há server ativo desta revisão.
Integração dos pais, conflitos B1/C2 e CI C4 ainda pendentes.
