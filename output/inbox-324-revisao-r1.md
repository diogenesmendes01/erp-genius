# PR #413 — respostas à revisão R1

Referência: review5635519413 (APPROVE, sem blockers). A revisão foi conferida contra o código e os resultados reais; os comentários abaixo incluem os itens LOW.

## C1 — integração e escopo do CI

O CI40039411802 do head e991 aprovou cinco checks: TypeScript, lint, build e unitários em UTC/America_Sao_Paulo. Ele não executa arquivos de integração; essa limitação é preservada. A evidência original de54testes não era apenas do autor: o TESTER executou independentemente cinco arquivos completos na preparaçãof9, cuja árvore é integralmente igual à composição567. O índice guarda fonte, sessão94331/19cc40 e parecer completo, sem inventar nova execução em7ff.

Após o ajuste C5, o integrador repetiu os mesmos cinco arquivos completos na fonte de revisão: sessão13774/7534a1,saída0,54testes,206,97s,perfilintegracao487,clientepróprio,configintegration/maxWorkers1,sem filtro/skips. São os mesmos54casos, não108distintos. Incluem pool1, locks concorrentes, autorização fresh após espera, rollback e no-op sem evento/aviso. Banco restaurado em bf350c,saída0,424hashesconferidos. A política atual do repositório mantém a suíte remota completa no workflow noturno/sobdemanda; não se atribui aprovação de integração aos cinco checks rápidos.

## C2 — texto de contato sem nome

Mantido o texto factual: o contato foi criado pelo telefone e, quando autorizado, o operador pode preencher o nome. Não existe automação que peça o nome nessa entrega. Prometer que a Aria fará essa pergunta induziria o usuário a esperar uma ação inexistente. A SPEC já documenta esse limite e o fluxo conserva preenchimento manual, capacidades e CAS. Não foi acrescentada automação, promessa ou regra nova de produto para resolver o texto.

## C3 — resultado incerto ao salvar nome

Mantido idempotente:false com justificativa junto do hook. Esse sinal governa a orientação após falha de transporte. A action usa CAS por nomeAnterior: repetir uma versão obsoleta pode retornar conflito em vez do mesmo resultado. O texto de resultado incerto manda conferir antes de tentar novamente; idempotente:true prometeria reenvio seguro sem esse contrato. O comentário não muda JS emitido ou comportamento.

## C4 — capturas acessíveis na PR

Acrescentadas à descrição seis imagens inline do estado sem nome, três tamanhos×dois temas, extraídas exclusivamente do pacote positivo original2396,sem nova captura/reatribuição. São627.933bytesPNG,6/6hashesconferidos;upload8dec5e,metadados5e741b,roundtripautenticadodc21db,saídas0. Os assets estão na mesma release privada em rascunho; nenhum PNG foi commitado. Os97originais e6estados vazios posteriores continuam em seus pacotes nominais. A ausência de PNG exportado do protótipo foi declarada; a referência originalHTMLnão foi fabricada.

## C5 — tag inativa

Corrigida a orientação do erro: “Esta tag está inativa. Reative-a no CRM antes de atribuí-la.” O sistema continua recusando o vínculo inativo e preservando a tag existente, sem reativação implícita, nova tag, evento ou aviso. O teste de integração foi fortalecido no caso já existente: RED1641fb saiu1 por diferença exata da orientação (um caso executado/14ignorados pelo filtro diagnóstico); o GREEN completo posterior13774/7534a1 passou54testes/zeroignorados. O uso compartilhado do núcleo no CRM recebe a mesma orientação; assinatura, autorização e transação permanecem iguais.

## C6 — registros de evidência

Mantidos o quadro único e os manifestos/pareceres curados, conforme AGENTS: commit por funcionalidade, evidências e pendências no quadro. Logs brutos, scripts administrativos, credenciais, negativos e ZIP/PNGprivados continuam fora dos commits desta PR. Os pareceres guardam fontes e hashes físico/LF para permitir auditoria. Não se moveu evidência para esconder uma execução negativa.

## Fechamento pendente

A suíte unitária completa final65123/e8df9a terminou0:914arquivos/7.188testes,221,23s,maxWorkers2,sem filtro/skips; configuração unitária exclui integração. TypeScript73934/9abbde e lint0fb4d9 dos três arquivos terminaram0/zeroavisos. Revisão independente no SHAexato0e4ec6ed: UNIT165dda,saída0,4arquivos/37testes; INT46676/ba3aed,saída0,2arquivos completos/25testes,96,11s,semfiltro/skips. Parecer favorável `inbox-324-qa/revisao-c5.md`,SHAoriginal/LF88ad7fe2fee0ef298d8dbbaadee3e95dbab7a0369a2de44c8551d423632ea1c4. TconferiuJSemitidoC3igual emd8103b0. Integração corrente é nova execução na fonte0e4; os54casosoriginaiscontinuamnominais àpreparação. ROOTrestauroeb2213,saída0,424hashes/snapshotmantido. O novo head, CI remoto e leitura final de comentários serão registrados antes do merge. Não é declaração de issue concluída.
