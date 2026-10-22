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
- Aceite app×protótipo foi realizado com o harness #307 em ambientes preparados pelo integrador. Sem schema, permissão, envio externo ou alteração de contrato de negócio.

## Estado

Fonte congelada b8d5128a; código aprovado pelo TESTER (53 testes independentes). Globais próprios:845arquivos/6533testes,TSC,lint0/40. Prova DEV18PNGs de fontes/tokens; dt solicita600 com face400–500, limite preservado. Aceite formal combinado7e236e64: integrador e TESTER34PNGs/0falhas/14diagnósticos/exit0, três tamanhos/dois temas; prova independente de fonte400/500 e Roboto6/6. Global final76a08316 (sóenum de teste307 após pixels) sessão95778:846arquivos/6547testes,TSCheap8192,lint0/40, todosexit0. Evidências em `output/inbox-306-comparacao/`; relatório `output/inbox-306-report.md`. A referência do protótipo usa fonte de reserva offline, e abrir conversas altera contadores de leitura; comparação de estrutura, sem paridade pixel a pixel dos contadores.
