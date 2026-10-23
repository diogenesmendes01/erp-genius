# #335 — checkpoint de código DEV A

Branch codex/inbox-e2-335 sobre 8e503a72d8e25c5c9244956e975376c3fa351e8a, checkout252a59, perfil dev-email487. Plano privado output/inbox-335-investigacao-dev-a.md aprovado; ordem técnica335→336→325. História agregada somente local: integrador reconstruirá publicação sobre MAIN depois da324. Código entregue para revisão, não issue concluída.

## Entrega e contratos

hrefConversa(atendimentoId, {agendar?}) é função pura: caminho fixo /inbox?c=, id bruto por encodeURIComponent e &agendar=1 só quando true. Não autoriza um alvo, não executa agendamento e não depende de Next/Prisma. #336 será dona do atendimentoParaAbrir/escopo por alvo e preencherá o linkB2B; não herdar conviteA paraB. #325 manterá Falar com no aceite completo, sem URL fabricada.

DadosSetor FINANCEIRO e SECRETARIA ganham matriculaId:string|null. É o ID da relação já selecionada (paineis.ts já pedia id/codigo), sob exatamente o MESMO gate do código: Admin/Financeiro/Secretaria no Financeiro; Admin/Secretaria na Secretaria. Convidado de outro papel recebe ambos nulos. Sem query, schema, migration ou ACL nova. Cobrança ativa e todos os outros campos/filtros permanecem.

PainelSetor usa o código real como nome do link /matriculas/id codificado. Sem id, mantém código em texto; sem código, não cria link sem nome nem exibe o ID. A página destino continua validando papel/carteira. Abrir contato no Funil corrige /contatos/id para /contatos?c=id codificado, mantendo a mesma Pessoa da oportunidade e todas as regras existentes. A exceção comercial D13 não vira acesso global ao CRM.

#324 (TagPainel.id/cabeçalho/tags/slots), #323 (resolver/D13/empresas distintas/autorizações), leitura/R6/ACK/SSE/URL e Compositor/Rodape/Sino337 permanecem. Scripts visuais não foram editados: ownership B337 até handoff. Nenhuma instalação/Prisma/DDL/seed manual/ambiente/push.

## TDD e gates — Node22.23.2

Executável C:/Users/Mendes/AppData/Local/hermes/node/node.exe e node_modules locais. Config unitária exclui *.int.test.ts. Integração com vitest.integration.config.ts/perfil dev-email/maxWorkers1, uma execução por vez. Todos os comandos finais sem -t e sem skips novos; não são suíte global.

| Marco | Executor / terminal | Resultado observado |
| --- | --- | --- |
| RED unitário | 0d2a8e | saída1;23 casos executados,20passam/3falhas causais: dois links matrícula ausentes e rotaContato antiga. Módulo novo encoder ausente/0casos é contrato ausente, não RED causal de comportamento |
| RED integração | sessão73676,98595f→bb5d73 | saída1;13 casos,12passam/1falha: matrícula/código reais presentes e matriculaId ausente. Novo cenário com6atores; não falha de fixture |
| Diagnóstico privado de edição | 0d283e | SyntaxError de script privado antes de qualquer escrita de fonte; corrigido no próprio script, não é RED produto |
| GREEN inicial | 610972 | saída0;4arquivos/31 testes,1.10s: encoder5, PainelSetor12, Funil11 e rota3 |
| Amplo dirigido final | sessão45159,ed9b94→9a719c | saída0;65arquivos/653 testes,17.76s, maxWorkers2 |
| INT final completo | sessão1473,8d2751→fa0266 | saída0;3arquivos/32 testes,104.27s, maxWorkers1: paineis.int, paineis-envio.int, painel-detalhes.int |
| TypeScript final | sessão16563,b5fb6c→57e776 | saída0; --noEmit/heap8192 |
| ESLint dirigido final | 818ebc | saída0;9 fontes/testes alterados, --max-warnings=0 |
| Diffcheck | 0db43c | saída0; nenhum sensor/registro de guarda alterado |

Recorte amplo nominal: src/app/(app)/inbox; src/app/(app)/funil/PainelOportunidade.test.ts; src/lib/href-conversa.test.ts; src/server/inbox/{paineis-tags,painel-detalhes,painel-abas}.test.ts; src/app/api/inbox/atendimentos/[id]/painel; src/app/{botoes,fundo-sobre-pagina,identificacao-registro}.test.ts. Inclui composição324, sem-polling e a guarda finalE1 do diretório Inbox. Avisos informativos Vite tsconfigPaths/configintegration mixedexports não foram suprimidos ou tratados como instalação necessária.

## Cobertura e rastreabilidade

| Contrato | Teste real |
| --- | --- |
| Encoder relativo / opção | href-conversa.test.ts: monta URL relativa com o id bruto codificado e não interpreta a opção de agendar |
| Escape de origem/parâmetros | it.each: o id %s não muda origem, caminho ou parâmetros (Unicode, espaços, ?,#, &, / e origem aparente) |
| Código como nome acessível | PainelSetor.test.ts it.each: %s usa o código real como nome do link, nunca o id (Secretaria/Financeiro) |
| Ausência legítima | sem id conserva código como texto; sem código não cria link sem nome |
| Contato real / rota correta | PainelOportunidade.test.ts:335 Abrir contato usa a ficha existente /contatos?c= e codifica a pessoa sem trocar identidade; Pessoa null não oferece link |
| Gates não vazios | paineis.int.test.ts:335 id de matrícula segue os gates atuais do código, nunca a mera participação no atendimento. Admin/SEC/FIN positivos conforme setor; vendedor/professor convidados negativos; Financeiro convidado Secretaria negativo; ator foraescopo null; sem matrícula null |
| Regressão do DTO | Expectativas anteriores Secretaria/Financeiro mantidas com novo campo exato; nenhuma asserção negativa removida. Rota preserva200/no-store/auth/404 |

## Banco e pendências

RED73676 e GREEN1473 terminaram; banco A liberado ao ROOT após fa0266, nenhum executor/servidor/browser A ativo. SnapshotE2 #323 é o único restauro permitido, mas o DEV NÃO presume execução desse restauro: confirmação do integrador fica pendente neste checkpoint.

Visual obrigatório ainda pendente: estado app-only painel-secretaria, fixture legítima ROOT com Aluno/Matrícula/código e permissão, dois temas, clique até página autorizada/retorno/foco. Não presumir que Lucas-origem307 possui matrícula: seed histórico não informa esse vínculo. Nenhuma imagem/probe/captura ou código de CLI335 foi produzido; B337 mantém scripts até handoff e só ROOT inicia preview/fixtures.

QA independente, global integrado, fixture/visual, base de publicação/PR e CI pendentes. Nenhum global próprio ou gate antigo da324 é reatribuído à335. Fonte executável permaneceu igual após os gates; somente SPEC/quadro/relatório serão consolidados antes do commit. Plano/investigações325/335 e todos outputs privados anteriores preservados.
