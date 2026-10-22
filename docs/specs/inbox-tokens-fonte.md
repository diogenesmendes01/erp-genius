# SPEC — #306: tokens e fonte mono do Inbox

## Contrato

Base E0 fechada `bcc3d27ab007231a08cabe2c3cf9c9b46a151558`; branch preparada pelo integrador `codex/inbox-e1-306` no asset commit `3eb87ea6c41c27edd10333e89594cd33e3b232af`. Entrega: oito tokens de avatar, balões IA/nota, pontos de conversa, utilitário `fundo-conversa` e JetBrains Mono local na variável `--font-mono`. Nenhum consumidor do Inbox é redesenhado nesta task.

Fonte entregue pelo integrador: JetBrains Mono 5.3.0, OFL 1.1; SHA256 `18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e`, conferido no asset local. Faixa registrada 400–500, sem alterar Roboto100–900/pesos de UI400/500/600. Usos futuros mono 600 ficam para as tasks consumidoras, por decisão do integrador.

## Execução e TDD

1. Escrever testes dos valores literais por tema, avatares com branco >=4,5, autoteste de avatar reprovado, pares de balão/autores, fonte/hash/licença e registro no layout.
2. Provar CSS compilado por PostCSS/Tailwind local com amostra explícita dos utilitários novos. Sem consumidor, Tailwind elimina classes; a mera definição não prova emissão.
3. Observar RED antes de tokens/layout/config; implementar valores em hex/rgba (sem enfraquecer parser de contraste), mapa de sólidos, fonte local e documentação.
4. Rodar recorte DS/contraste/tipografia/paleta/contraste-elementos e lint dirigido. Congelar fonte e enviar SHA; globais sob janela do integrador.
5. Visual coordenado com #307: três tamanhos × dois temas, app/protótipo e amostra dos tokens novos. Verificar `document.fonts.load` pela família real e elemento mono temporário, preservar Roboto no texto. Amostrar usos existentes fora Inbox (códigos/hash/template), pois font-mono é global.

## Decisões e limites

- Avatares: hex derivados da adaptação L 0,54; branco passa em todos (pior4,67:1). O tom original do protótipo L 0,58 precisa reprovar no autoteste.
- Texto secundário nos quatro balões e autores por semântica passam 4,5:1. Autor no balão verde usa brand-strong, pois brand-text no escuro dá4,09:1. Isso prepara o contrato; não altera componente consumidor nesta issue.
- Exceção estreita ao princípio sem gradientes: somente radial-gradient para pontos de 1 px repetidos a18px no fundo de conversa. Sem gradiente decorativo geral e sem afrouxar travas.
- Mono registrada 400–500, licença acompanhando asset, nenhum pacote/lock alterado, nenhuma fonte/runtime de CDN.
- Aceite app×protótipo depende do harness #307 e ficará pendente até sua entrega. Não iniciar servidor/banco nem baixar assets sem coordenação. Sem schema, permissão, envio externo ou alteração de contrato de negócio.

## Estado

Fonte congelada b8d5128a; código aprovado pelo TESTER (53 testes independentes). TSC global, full 845 arquivos/6533 testes e lint 0/40 aprovados no Node 22.23.2. Prova DEV:18 PNGs nos 3 tamanhos/2 temas, fonte carregada 400/500, Roboto preservada, trechos reais isolados sem overflow externo. dt já existente solicita 600 com face 400–500; limite documentado sem alterar a faixa contratada. Aceite formal app×protótipo aguarda harness 307. Relatório: `output/inbox-306-report.md`.
