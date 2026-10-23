# Inbox #324 — composição sobre main

O cabeçalho do contato permite editar tags autorizadas e salvar o nome de um contato sem nome. As operações reaproveitam os controles de acesso do CRM, usam identidade resolvida no servidor e preservam atomicidade, autoria, histórico e avisos transacionais. Quem apenas participa da conversa mantém a leitura autorizada, sem receber permissão de edição do cadastro.

Base direta: main `2712f4d28722c0c971f5464d82553a1ccfa92560`, após #412. Patches selecionados do produto `2396a6c7`, harness `ce658d8d` e documentação `8e503a72`; aplicados em `88e50c74`, `c38ce158` e `567ed5e1`. A árvore de567 é integralmente igual à preparaçãof9c14500 (`06f41e5bd619631656df30307a91b89d98ca102f`). Nenhuma migração, dependência ou código de outra issue futura foi incorporado.

## Gates e revisão independente

A primeira regressão ROOT23214/ca195c saiu1:913arquivos passaram/1falhou,7.186testes passaram/1falhou. A guarda de estados vazios detectou o parágrafo da busca de tags. O resultado negativo é preservado. Corrigido em `7ff341db2e11a92d2b42747749ddab469e862603` com o componente compartilhado `EstadoVazio role=status`, margem permitida e registro literal no mapa, sem exceção ou alteração do algoritmo da guarda.

O teste novo falhou causalmente em22f6ac antes da implementação. A primeira tentativa de GREEN44816/8611c2 terminou1 por EPERM na renomeação do cache temporário do Vitest, sem executar testes; não é RED de produto. A mesma execução autorizada fora dessa restrição terminou0 em9ded13,4arquivos/48testes. TESTER independente no SHA7ff:3arquivos/31testes789ac0,saída0,parecerfavorável.

Gates finais ROOT na fonte7ff, Node22.23.2, Windows:

- Unitário completo: sessão77906/5a1b72,saída0,914arquivos/7.188testes,46,30s. Comando `node node_modules/vitest/vitest.mjs run`, configuração unitária padrão excluindo integração, sem filtro por nome ou skips.
- TypeScript:97cf38,saída0,heap8192. Nenhuma rota mudou desde o typegen da composição anterior.
- Lint dos três arquivos alterados:077d9d,saída0,zeroavisos. Lint global da composição anterior567:6456/c1597b,saída0,zeroerros/40avisosherdados; esse resultado não é uma nova execução em7ff.
- TESTER na preparaçãof9:7arquivos/123unitáriosf4341d,saída0. Integração94331/19cc40,saída0,5arquivos completos/54testes,193,60s,`vitest.integration.config.ts --maxWorkers=1`,perfilintegracao/clientepróprio487,semfiltro/skips. Foram executados `acoes-painel-tags.int`, `acoes-painel-tags-pool1.int`, `paineis.int`, `painel-detalhes.int` e `crm/tags.int`. Não são somados como testes distintos às rodadas anteriores. A igualdade integral da árvore com567 foi conferida; o delta posterior7ff é exclusivamenteUI/teste/mapa e não recebeu uma nova execução de integração.

Sete pareceres integrais, com fonte nominal e hashes físicos/LF, estão em `output/inbox-324-qa/indice.json`. As revisões abrangem o código original, harness, imagens originais, composição unitária, integração e o patch do estado vazio. Nenhum parecer nominal foi reatribuído a outra fonte.

## Evidências visuais e limites

As97PNGs originais do produto2396/harnessce658,7.105.217bytes, são preservadas:24formais+73complementares;26pranchas derivadas não aumentam a contagem. Cobrem nome sem cadastro, busca/tags, CRUD temporário autorizado, teclado, campos indisponíveis durante gravação e alturas reduzidas. O relatório original `output/inbox-324-report.md` preserva executores, negativos e limites de alcance; não promete encaixe ou estabilidade maiores que o observado.

Arquivo privado sanitizado na release existente em rascunho: `inbox-324-aceite-2396a6c-20261023.zip`,7.178.506bytes,SHA256 `080a876faa1518ac3ddc59e58510aeea46e7255a190f57ca640505311d193e8e`,asset670630290. Reabertura autenticada824fbc confirmou o mesmo SHA. Só97PNG+manifesto/READMEcurados, sem credenciais, logs brutos, sondas, negativos ou scripts administrativos. [Pacote histórico](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-324-aceite-2396a6c-20261023.zip).

O estado vazio alterado em7ff recebeu seis capturas independentes do TESTER, executor4a5eec,saída0:1440×900,1024×768,320×500,claro/escuro. As seis imagens foram inspecionadas: aviso e Criar separados e inteiros, foco/Tab/Shift+Tab, retorno à sugestão real e documento sem overflow; zero pageerrors ou chamadas externas. Não houve clique de criação/gravação. São433.192bytesPNG,allowlistSHA256 `fe8fbc229ff8704ede9ceb7aece9567abc3b1aafdc32fcf85d2cb267f049e661`. Negativos iniciais de seletor do probe foram preservados fora da allowlist; nenhuma mudança de produto foi feita para acomodar o probe.

[Complemento visual atual](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-324-estado-vazio-7ff341d-20261023.zip):417.963bytes,SHA256 `feee5cab13a78a055c430eddbd6f5f921175ff7795092fe9d76b9829e5a2cc33`,asset670692813. ZIP reaberto com CRC/hash pelo TESTER, oito entradas:seisPNG+manifesto/README. ROOTinspecionoub63a27,upload9577860,metadados63f225confirmamreleaseaindaemrascunho;roundtripautenticadoa4b8660SHAidêntico. O pacote histórico não foi substituído.

## Ambiente

A integração foi restaurada emcd66b7,424hashes/snapshotmantido. Para o complemento visual foi reservado o mesmo banco descartável487 ao ROOT, com snapshot494linhas. O primeiro plano de seis registros não tinha oportunidade: o GET real retornou editarTags=false, coerente com a política existente. O banco foi restaurado emfe16f9 e o plano completo criou oito novos registros fictícios, incluindo oportunidade e uma tag sem vínculo, com424hashesoriginaisconferidos; b34e61saída0. Preflightb6f2a0 confirmou200nasrotaspainel e painel/detalhes, capacidades reais editarTags/criarTag e a sugestão fictícia. O caminho errado /detalhes404 da tentativa iniciala4993b foi corrigido no helper privado; nenhuma política de produto mudou.

Preview e credenciais são exclusivamente locais, transportes externos vazios, canal fictício desconectado. Não há nova nota, mensagem, envio real, integração externa ou deploy. O complemento usa apenas busca e teclado; o banco foi restaurado após o fechamento de todos os contextos:914af4,saída0,424hashesconferidos,snapshotmantido. Preview45628encerradoporCtrlC/573396,saída1esperadadeencerramento;porta3108livreb241d4. As dez linhas geradas pelo Next emAGENTS.md foram removidas exclusivamente apósstop,b63a27saída0,instruçõesoriginaisiguaisaoHEAD. CI remoto, novos comentários e merge ainda são gates pendentes.
