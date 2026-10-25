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
