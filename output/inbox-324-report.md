# #324 — checkpoint DEV A

Base local 272a2b33452944d77b5f1e6ed2a750981f57c1bf; branch codex/inbox-e2-324. A antiga investigação permanece em output/inbox-324-investigacao-dev-a.md (SHA-256 eddf4077c38dc553726dad3071fb333c2efd8a0c3f4a7ac41f5677c43953d690) e ref codex/inbox-e2-324-investigacao-58b2. Issue324 remota aberta, corpo completo relido. Agregado é somente base local: integrador reconstruirá publicação sobre MAIN/follow-up; sem push desta história.

## Entrega de código

TagsContato oferece busca no catálogo autorizado, até oito sugestões, correspondência sem caixa/acento sobre TODO catálogo, remoção e criação por capacidades atuais. TagPainel ganha id obrigatório. D20 conserva ✦/autor histórico; sem trocar autor em repetição. Popover descendente do painel, fixo e medido pelo helper existente, sem portal nem Menu com input; foco, Escape/setas, scroll interno e fechamento externo/resize. Sucesso tardio não rouba foco de fora nem limpa busca editada, e A desmontado não aplica callback em B.

ContatoSemNome reutiliza editarNomeContatoWhatsApp/CAS bruto. Sem promessa de pergunta automática Aria. Input indisponível durante salvar; base CAS local atualizada após OK, conflito/incerto conserva texto. Sem callback de A sobre B. Slots aditivos preservam fallback E1/fechar único e rolagem local. InboxNovo muda somente imports e JSX dos slots; hooks/read/SSE/ACK/syncURL permanecem. Após404, leitura do snapshot permanece e escrita nova é retirada por acoes != null.

Núcleo CRM transacional compartilhado aprovado: exports públicos anteriores preservados, TagSchema mínimo exportado, mesma capacidade/escopo Pessoa/Empresa. Nome exato com lock antes do vínculo, sem schema/canonicalização novos. Wrappers resolvem pessoa e lead na mesma tx; callback pós-lock revalida contexto antes de escrita. Somente mutação emite Evento e aviso; trigger envia IDs no commit, rollback cancela. Não usa prisma global dentro da tx. Campos/permissões321/resolver323 não foram alterados.

## Execuções observadas — Node 22.23.2

Executável C:/Users/Mendes/AppData/Local/hermes/node/node.exe, bibliotecas locais intactas. Integrações: vitest.integration.config.ts, perfil dev-email 487, maxWorkers=1, uma suíte por vez; sem seed/SQL manual/Prisma/install/DDL. Unitário maxWorkers=2; config unitária exclui *.int.test.ts. Não houve global próprio.

| Gate | Executor e terminal | Resultado e limites |
| --- | --- | --- |
| RED TagPainel.id | sessão25760, 7a8600 → b08960 | 12 casos, 11 passam / um falha exclusivamente ID ausente; saída1 |
| Módulos ausentes iniciais | 798786 UI / 603eb6 actions | import ausente / zero casos; marco de contrato ausente, não RED de comportamento executado |
| Actions inicial | sessão35033, 8c6d4b → 6ad524 | 12 / 12, saída0 |
| RED pós-lock inicial | sessão57082, 785fcb → 8e6fed | 13 passam / uma falha de revogação |
| RED pós-lock fortalecido | sessão85498, 7f8ae4 → 8e17a1 | duas falhas reais; -t revalida contexto, outros12 omitidos. Pessoa antiga permanece na carteira por outra oportunidade: caso não-vácuo |
| GREEN pós-lock completo | sessão70190, 638682 → 7072b3 | 14 / 14, sem filtro/ignorados novos, saída0 |
| RED UI | d52d3c / 73de2c / def02c | teclado/slots, input ocupado e foco tardio; causas registradas antes dos patches. Uma tentativa intermediária300230 falhou por fixture local não suportar :disabled e uma expectativa de property disabled; corrigido somente o fixture local para atributo nativo, helpers globais intactos |
| GREEN UI inicial | 3ef0be | seis arquivos / 116, saída0 |
| Amplo / TSC antes dos registros | sessão77431 → a8a8b2;44142 → f806d9 | 750 passam / cinco falhas de registros Task12; TSC inferência void versus tagId. Registros exatos coordenados e executar<unknown> sem cast |
| Integração regressiva completa | sessão28822, 6d5b62 → 55731f | cinco arquivos / 53 casos,171,34s, saída0: actions14, pool1, paineis, painel-detalhes e CRM tags. Backend invariante desde essa execução; último delta posterior é mais um teste SQL de concorrência |
| GREEN amplo após registros | sessão23101 → 7c40d1 | 64 / 755,33,18s, saída0 |
| Diagnóstico concorrência de sessão | sessão73298 → 4e76d9; a82abb;c35889 | 14 passam / um falha por import concorrente do mock NextAuth (next/server ERR_MODULE_NOT_FOUND), antes do SQL. Preload rejeitado por experimento e removido; nenhuma correção em Next/deps/produção. O caso final usa dois clientes/transações e ator fresco do banco conforme ruling. Concorrência do boundary de sessão NÃO é coberta pelo novo caso |
| RED404 e sincronização | b803dd;55654 → ec19ef | teste consultava snapshot antes de disparar/aguardar efeito404; não contar como RED causal suficiente. Harness corrigido para aguardar resposta e confirmar podeEnviar=false antes das tags |
| Prova causal404 sincronizada | b1f75a saída1, 3db58d restauração | retirado temporariamente só o gate novo; leitura e podeEnviar=false já confirmados, edição/criação ainda true. Um falha /80omitidos por -t. Gate restaurado imediatamente;048ad9 tinha passado o caso sincronizado com gate |
| Amplo final | sessão30020,7331d7 → f68c39 | 64 arquivos /756 casos,29,63s, saída0, mesmos filtros abaixo, sem -t/skips novos |
| Integração actions final | sessão29145,33da2b →689461 | 15 /15,48,62s, saída0, sem -t/skips novos; duas conexões / duas pessoas, ator fresco e núcleos produtivos. Não é nova execução dos outros quatro arquivos |
| TypeScript final | sessão48914,cc0010 →cded3e | --noEmit, heap8192, saída0 |
| ESLint final | 4124d3 | fontes/testes e quatro arquivos de registros alterados, --max-warnings=0, saída0 |

Recorte amplo nominal: src/app/(app)/inbox + src/server/inbox/permissoes.test.ts, paineis-tags.test.ts, painel-detalhes.test.ts + src/app/{botoes,paleta,identificacao-registro,fundo-sobre-pagina,campos-texto,confirmacoes}.test.ts. Inclui sem-polling/inbox-e1 e proteções de leitura no diretório, mas não equivale ao global. Lint inicial/final teve zero avisos no recorte; os avisos informativos de Vite/config mista não foram tratados como nova falha de teste ou suprimidos por mudança de configuração.

## Banco, preservação e pendências

Todas as sessões terminaram, nenhum servidor/browser iniciado. Banco A liberado ao ROOT após689461 para restauro exclusivo do snapshot E2 #323, ainda sem presumir o resultado desse restauro. Nenhum envio/nota/integração externa.

Visual OBRIGATÓRIO pendente: painel-detalhes e painel-sem-nome (1440×900,1024×768,390×844, dois temas), altura500/tags extensas/teclado/foco/posicionamento e casos reais. SSR/ReactDOM mínimo acima não medem CSS nem homologam browser/AT. Fixture semnome deve ser legítima e preparada pelo integrador; nome de lead não pode mascarar a fonte contato. CLI/estado novo, fontes/hashes/allowlists/inspeções somente após handoff/Ready, preservando a frente B337. Não há captura antiga reatribuída.

QA independente, global integrado, reconstrução/publicação do PR e CI ainda pendentes. Sem claim de issue concluída. Nota/menções/Compositor/Rodape/Sino, schema/migrations/deps/scripts foram preservados.

## Harness visual — preparo congelado #324

Produto 2396a6c7703d0717a523d93f51a210a75f588135 permanece byte idêntico; somente scripts/testes/documentação visuais mudam. Node22.23.2: recorte de harness b1e89d, 13 arquivos/93 testes, saída0, sem filtro/skips novos; lint1ce79e saída0/max0; TSC sessão19125, aa79df→3b3698, heap8192/--noEmit, saída0. RED5abebe demonstra estado/prontidão ausentes; falhas intermediárias de fixture e referência PNG inexistente estão preservadas, sem enfraquecer a app.

A matriz anterior164 permanece; painel-sem-nome acrescenta12, total176 (106 app/70 protótipo). Recorte formal desta issue:24 imagens, dois estados×três tamanhos×dois temas×dois alvos. Preflight real c0d2c2 saída0 confirmou GET200/semNome=true/podeEditarNome=true do contato324 e Mariana com pessoa/três tags. Preview13519 controlado pelo integrador; restauro823a46 e fixturee11a8f0 são operações externas. Nenhuma imagem capturada neste checkpoint.

Referência funcional sem nome: HTML original docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html, conversa c9/noName:true, SHA2567698a34bad041c95f45710cfe3ed6f79a97ba5f49bf5d941751c37324233d8cf. O PNG pré-exportado prototipo-estado-painel-sem-nome.png não existe; nenhuma referência foi fabricada. Manifestos devem distinguir produto app, harness e HTML original; a cópia antiga da referência sobre Aria não representa promessa da app. Captura/inspeção/QA/global/publicação continuam pendentes.
