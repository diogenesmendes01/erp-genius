# Candidata #329 — evidências DEV A

Base:83ad189a0f9ebecacea22def49e9afc63915424e, branch codex/inbox-e2-329-cliente-voltou. Esta candidata contém DTO/UI/Funil e hardening coordenado do ramo lead; não representa aceite final. Gates pendentes: TypeScript original/global, visual APP2temas×3tamanhos/PROTO original, QA independente do commit exato e CI.

## Validação do comportamento atual

Todos os runners abaixo usaram Node local, heap1024, maxWorkers1 e no-file-parallelism. INT usou vitest.integration.config.ts original/perfil dev-email492 com lease exclusiva ROOT, integrações externas vazias. Toda sessão foi acompanhada até terminal0. Recortes sobrepostos: não somar nem chamar de suíte global.

| Recorte | Arquivos/testes | Terminal |
|---|---|---|
| UI/DTO/SSR/Funil inicial |14/162|d38a3b EXIT0|
| Inbox interação/foco/Aria/detalhes |4/133|47c24c EXIT0|
| UNIT ação corrigida/garantir/DTO/linha/AcoesContato/auditoria |6/69|e8cb65 EXIT0|
| ACTION pública corrigida + institucional/controle/repetição/deriva nativa |1/4|139026 session34578→7e5210 EXIT0|
| Concorrência nativa7 + pool1/legados PessoaNULL/rollback4 |2/11|a715d2 session57412→b79c64 EXIT0|
| Concorrência expandida11 + desvincular7 + linha-comercial24 |3/42|db433a session87607→94d1e5 EXIT0|
| Leitura32915 + legados aluno/responsável2 + acesso-atendimento11 |3/28|d7a55c session3362→8512dc EXIT0|
| Lint hardening/provas/ClienteVoltou |9 arquivos|f761af EXIT0 sem warnings|

Filtros exatos das integrações atuais: src/server/inbox/cliente-voltou-action-caracterizacao.int.test.ts; src/server/inbox/cliente-voltou-concorrencia.int.test.ts; src/server/inbox/cliente-voltou-pool1.int.test.ts; src/server/inbox/cliente-voltou-legados.int.test.ts; src/server/inbox/cliente-voltou.int.test.ts; src/server/whatsapp/desvincular-contato.int.test.ts; src/server/whatsapp/linha-comercial.int.test.ts; src/server/whatsapp/acesso-atendimento.int.test.ts. Últimas execuções completas de cada arquivo, sem teste ignorado. UNIT6: src/server/inbox/{cliente-voltou-action-caracterizacao,cliente-voltou-vinculo-caracterizacao,cliente-voltou}.test.ts; src/server/whatsapp/linha-comercial.test.ts; src/app/(app)/inbox/AcoesContato.test.ts; src/server/crm-config/auditoria.test.ts.

## REDs e limites das provas

Antes do patch, ACTION real com doubles DB4/4 f4cc9d e integrada Postgres4/4 session87293→aba141 caracterizaram sucesso institucional em outroID, repetição2Eventos e deriva. A primeira deriva integrada intercalava escrita real via spy de fronteira; não foi chamada de concorrência SQL. Na suíte atual, ela foi substituída por transações reais com espera comprovada por pg_blocking_pids.

REDs da correção: UNITf01eeb EXIT1,2falhas/2controles; INTe88011/session53666 EXIT1,2falhas/2controles; barreiraContato nativa b4cd57/session62689 EXIT1,2falhas/2controles. Depois helper/CAS: UNITe29754 EXIT0,4/4 e INT7e5210 EXIT0,4/4.

O primeiro detector concorrente c7335a EXIT1 tinha uma falha de formato de query,6pass/1fail. O cenário com outroLead a1836e passou1 com6skips porque recusava antes de esperar Contato; foi ajustado para vínculo repetido MESMOlead. Este cenário312c6f EXIT1,1fail/6skips, reproduziu Postgres40P01 real em desvincular. Só após esse RED o ramo lead de desvincular alinhou Selected→Contato. As execuções completas atuais42/42 incluem cenário corrigido, sem skips. Não se afirma ausência geral de deadlocks fora dos escritores/ordens cobertos.

Pool1 limita connection_limit=1/pool_timeout=3 no processo do teste, sem mudar arquivo .env, configuração de DB ou dependências. Prova que esta transação não pede conexão global adicional; sessão inicial permanece fora da TX. O rollback é Postgres real após writes, com erro de Evento INJETADO; não é uma falha nativa do Evento. Repetição manual da ação mantém contrato Evento por POST (2posts→2Eventos); UI idempotente:false e sem retry automático.

Negativos adicionais preservados no ledger: Funil inicialmente falhou por DOM mínimo select.options/self (corrigidos só no teste); depois RED funcional27f13b,4falhas/1pass. DTO RED9ebe52→GREEN3e1b0a16/16. Composição8ac761 RED; lintdd259b detectou ref durante render (movida para efeito); assertions legadas sobre slot direto301766 foram adaptadas para inspecionar filho do fragmento, mantendo slot vazio ausente. INT leitura f86ed2,14pass/1fail, revelou fixture convidado que ainda tinha acesso próprio pela fila; responsável passou para outro dono, nenhuma ACL mudou, rerun31269315/15.

AGENTS autogerado, outputs privados e corpus anteriores preservados fora do commit. Sem install/ci/npx/pnpm, schema/migrations/package/lockfile, ativação externa, push ou deploy. Lease dev-email492 liberada ao ROOT após8512dc; somente ROOT restaura snapshot492, nunca491.

## Correção editorial de guardas, filha da candidata47a4c5c3

As guardas ROOT sobre47 tiveram238/241 aprovados e3falhas: faltavam duas entradas em botoes-mapa; ClienteVoltou imprimia situacao sem rotular; Outras definia rótulos de EtapaLead localmente. O ajuste registra os dois botões e cria SITUACAO_CLIENTE_VOLTOU_LABEL e SITUACAO_OUTRA_OPORTUNIDADE_LABEL em labels.ts, ambos Object.freeze e registrados nominalmente em MAPAS_NOVOS. Nenhum parser/exceção foi relaxado. labels.ts continua exportando apenas rotular e os mapas permitidos; situacaoOutra fica como wrapper compatível no componente, apenas chamando rotular no mapa central. ClienteVoltou usa o rótulo central em minúsculas na frase, preservando seu texto.

A nova etiqueta de outras oportunidades usa os quatro rótulos editoriais aprovados: Primeiro contato · em aberto; Experimental agendada · em aberto; Experimental realizada · em aberto; Aguardando matrícula · em aberto. ETAPA_LABEL global permanece intacto. Não há alteração de backend, DTO, ação, alçada, classe visual ou banco neste commit.

REDs adicionais:66eaf2/session33216→00ec32 EXIT1,299pass/2fail em8arquivos: exporthelpercentral e mapanãoregistrado foram recusados pela guarda fechada. A alternativa de mapas removeu o helper central; e108c5/session30981→6a7ba0 EXIT1,319pass/1fail em10arquivos: etiquetas derivadas de ETAPA_LABEL legado violavam sentencecase. Não houve exceção: os quatro rótulos locais329 receberam revisão editorial, com casos renderizados específicos.

GREEN: d95a13/session19972→654db3 EXIT0,10arquivos324/324,52.81s; heap1024/1worker/no-file-parallelism, sem filtro/skip. Arquivos completos: src/app/{botoes,enums-rotulos,paleta,rotulos,rotulos-dominio}.test.ts; src/components/Botao.test.ts; src/app/(app)/inbox/abas/{OutrasOportunidades,ClienteVoltou,AbaOportunidades}.test.ts; src/app/(app)/inbox/InboxNovo.detalhes.test.ts. Lint whitelist6 e diffcheck971714 EXIT0. Backend47 e DTO congelados para TESTER, sem diff no servidor; sem lease/execuçãoDB DEV A.

Este commit corrige apenas guardas/rótulos do frontend. TypeScript original/global, fullUNIT, visual, QA independente e CI continuam sob coordenação ROOT e sem aprovação presumida. Não foi reaproveitada evidência SQL de47 para afirmar QA desta fonte composta.

## Correção frontend filha de65 após gates globais ROOT

O fullUNIT ROOT65 foi negativo:966arquivos,963pass/3fail;8166pass/3fail8169 (session83803→6895e9). Ofensores: import irreversível sem confirmação em ClienteVoltou, lista vazia fora de EstadoVazio e linha muted sem borda. A TSC originalA session96476→a13da3 terminou2, com1086TS2307 nos três caches Next históricos privados e um TS2352 real na fixture FunilCliente.nova. Caches históricos foram preservados; nenhum tsconfig/exclusão/env/cache foi alterado pelo DEV. ROOT reexecutará a configuração original sobre o SHA final em checkout/dependências próprios do integrador; os negativosA não são chamados de green.

Correções: ConfirmarAcao canônico real/idempotente:false, abertura sem executar, cancelamento seguro por Voltar/Escape e foco devolvido, bloqueio de fechamento/duplo clique durante confirmação, falhas permanecem dentro do diálogo e ACK de sessão desmontada não reconcilia outra (inclui A→B→A). ClienteVoltou.test usa ReactDOM/ConfirmarAcao/Modal/useDialogo e executor reais; só a ação servidor é dublada. Teste DOM mínimo não comprova geometria de browser nem executa vínculo real. EstadoVazio compacto e borda neutra mantêm a superfície muted, com manifesto nominal atualizado. A fixture incompleta de PainelOportunidade recebe cast unknown explícito documentado apenas no teste de fronteira; tipos produtivos não foram relaxados.

O novo ponto de ação foi registrado exatamente por arquivo/módulo/ação e na cópia literal. Isso revelou bug estrutural preexistente: filtrar a lista apenas por arquivo diferente fazia dois donos registrados da mesma action se acusarem mutuamente. Com GO ROOT, a seleção cria Set de pares(modulo,acao) já registrados PARA O ARQUIVO e mantém proibidas todas as demais combinações. verificarConfirmacoes/importacoesForaDaLista/codigoOpaco e PorArquivo não mudaram; não há exceção geral. Autotestes do mesmo caminho cobrem dois donos dentro do ConfirmarAcao, terceiro sem registro com import/alias/reexport, owner que chama fora da confirmação e mesmo nome em outro módulo.

RED/GREEN preservados: UI7ba79d EXIT1,12fail/2pass14 → bdfce4 EXIT0,3arquivos27/27. Guardas+UI10cd91/session95244→864b5e EXIT1,408pass/2fail410 (manifesto de vazio/bugmultiowner). RED específico c841d6/session93447→6804a4 EXIT1,62pass/4fail66, antes do Set exato. Após correção:9172fe/session73994→a7fc53 EXIT0,14arquivos417/417,68.87s,heap1024/w1/semfileparallel, sem filtros/skips. Lint8 e diffcheck21c7f3 EXIT0. Arquivos completos do recorte: src/app/{confirmacoes,estados-vazios,fundo-sobre-pagina,botoes,enums-rotulos,paleta,rotulos,rotulos-dominio}.test.ts; src/components/Botao.test.ts; src/app/(app)/inbox/abas/{ClienteVoltou,OutrasOportunidades,AbaOportunidades}.test.ts; src/app/(app)/funil/FunilCliente.nova.test.ts; src/app/(app)/inbox/InboxNovo.detalhes.test.ts.

Backend/DTO65==47 e labels centrais sem diff neste fix; sem DB/provider/realaction. TSCoriginal/global, novo fullUNIT e QA independente do SHA composto/CI/visual permanecem pendentes ROOT. A rodada visual precisa registrar o ConfirmarAcao aberto e cancelar sem call; o arquivo offline output/inbox-329-visual-proposta-offline-65d9862c-r1-private.md é proposta de65, não execução nem aceite desta nova fonte (SHA físico d86ea437dce0871141d7d0c01f35105be8744967198bc4f3f0f8aca34701f643).
