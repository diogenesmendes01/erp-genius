# #360 R2 — renderização explícita sem alterar a guarda

Pai funcional congelado:78fb1f186910091aa2b1a5f42ae8df0d7d12cf5d. O delta de produção tem somente3 linhas trocadas em ConversaAberta.tsx: prop função renderizar no coordenador, chamada selfclosing renderizar={renderizarConversa} e consumo da porta. Nenhuma mudança de árvore física, handlers, foco, key, backend ou políticas.

A guarda original detectou a função JSX children como formulário descendente. A correção é idiomática no consumidor, sem parser, exceção ou pacote liberado. RED dad62b EXIT1:23 casos,22 pass e1 falha no trecho exato {renderizarConversa}. GREEN 29bf78 EXIT0:23/23, incluindo as negativas existentes. Heap2048/w1; não TSC/global.

UI relevante 46301/cb2299 EXIT0:13 arquivos/222 casos, pasta fluxos + consumidores ConversaAberta + InboxNovo.interacao, w1/1024. Oráculo independente T 8:3176f6 EXIT0; fonte copiada byteigual SHA d9698922575d40cbf72363ede30339d653baae38d1af7471c3826a2d79839d4c. Controller/Popover/diálogo reais, compositor é fixture form. Prova formulários irmãos, retry preservando textarea/chave e descarte de erro tardio; não substitui visual nem prova fullCompositor.8 casos incluem5 já sobrepostos e3 independentes, não somar como novos 8.

Fonte T somente lida: ownT/output/inbox-360-78fb-tester/oracle.test.ts. Cópia ownB/output/inbox-360-r2-oracle-tester-private/oracle.test.ts.txt preserva bytes. Config privada alterou SOMENTE caminho include para executar8; import/alias/body intocados, configuração original não alterada. Após o terminal, cópias TS privadas foram renomeadas .txt sem mudar bytes, para não contaminar futuros TSC/lint originais. Pins/log original T preservados ao lado.

WIP369 foi arquivado em 18 paths próprios via stash dbaf41bb407d0963e56d18406f051a2d663e2289, com cópias .txt e hashes: output/inbox-369-wip-before360r2-manifest-private.json SHA f5ef99936b6406e0e275b55cfafa055b8fab608ab0838a5e5b34b6b1b1e15506. Nenhum output/AGENTS/node_modules/config/schema entrou no stash. Após entregar esta filha,369 receberá ff da correção e aplicação do stash com união dos dois deltas; stash não será apagado antes da conferência.

Backend, schema, cliente, perfil e configs literais 78fb. Não repetidos INT14/reg41 conforme GO; nenhum SQL, browser, build, TSC, install, push ou PR nesta R2. QA independente no filho e visual/gates do integrador continuam pendentes. D5 depende de369/370; não concluído.
