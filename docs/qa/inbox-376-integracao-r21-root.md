# Integração ROOT376 — R21

Pai público a21b3098, código literal4d8 e documentação R20. Aplicado somente o delta de36arquivos2770→b37, sem importar ancestrais privados deGrant. Todos31SRC aplicaram por três vias sem conflito; conflitos somente no quadro e schema. O schema foi reconstruído como original público +inversaUsuario +modeloPresencaInbox literal; reversão recupera bytes exatos do schema público, semGrant e preservando Insights493/Forecast495. O quadro preserva todas as linhas históricas das duas fontes.

DEV3dd: novo checkpoint10 (41651/272572 EXIT0) e regressão17 (19224/278a1c EXIT0), em série/configoriginal/UTC/w1/1024/seteprovedoresvazios/semfiltro/skips. Não somar execuções históricas. Fonteb37 sódocs após3dd. O primeiro nativo c044 terminou12pass/5fail por perdaTZ no rawclock; controleRO4926e8 provou deslocamento-10800000ms ecastawarepreservandoepoch. Fix434 preserva schema/SQL e corrige rawclock +fixtureholder. Reentrada eACKperdido tiveramREDs causais e recuperação selfbound limitada ànovaentradaDeliberada, semgrant/vida implícita.

Build4d8 qa-YlX2olWnazLSFrbIYA foi arquivado fisicamente99e156 antes de modificar código,234assets verificados. RuntimeTESTER é cópia física independente do diretório ROOT, com módulos própriosT; nãoébuildindependente. Tpermanece4d8/banco495 para o aceite visual anterior, aguardando autorização de ferramenta. Nada disso homologa376.

Focal da composição:21arquivos/369casos,97885/2600d8 EXIT0,UTC/w1/heap1024/configoriginal/semfiltro/skips; mocksunitários,nãoSQL. Lint31SRC:60455/a17138 EXIT0/semavisos. Reversão deTODOoSRCemíndicetemporário64b1ff EXIT0 recuperou exatamente a21; schema também reversível, semGrant.


InfraROOT:validate65c609 EXIT0. Generate inicial56523/bdc633 EXIT1 writeUNKNOWN; diagnóstico71ec84 verificou191GBdisklivre,775MiBRAM e21arquivosclientiguaisbackup. Não atribuircausadefinitiva. PreviewTfoiparadoparajanelacontrolada;NodeinformouSTOPPED0masPTYretornou1noCtrlC,semUIexecutada. Retry56403/1147d3 heap1024 EXIT0,client990efce25e560694f0d7efa04337888e7debc5a67067340a4be6b135a99beb85. Schema2dc45e8860e4c634e8fc7b3035ab9dad748eeb874ce28589611280fed15cd7c9 eSQLrawb7952bc47c670979f44b326729fc2d189b7ac9f76e30c6d93d6f67c4db6c8890 preservados; SQLblobliteralB,rawEOLdiferenteporcheckout.

DDL209a49 EXIT0 somenteROOT:495migraçõesreais(logical496),426tabelas;424tabelasdedadosanteriores+histórico494+funções/triggers/índicesantigospreservados. Presenca0,4índices,4constraintsfuncionais+9NOTNULLPG18validados. Snapshot68355b EXIT0:426hashes/1382linhas,SHA81c52824254d372a34e11b04b93081599019e6e0c65d7fc4aa75e10a1c2a1762. Restauradoragora preservar-banco-root496-private.mjs; nunca495nesseestado.

Nativos ROOT concluídos depois deste registro inicial: sessão32640/terminal5c22ed EXIT0, checkpoint10 e presença17 em arquivos completos separados e seriais, configuração original/UTC/w1/1024/sete providers vazios/sem filtros ou skips. SnapshotROOT496 restaurado na mesma sessão com EXIT0. O banco do TESTER permanece separado.

Revisão independente estática TESTER da fonte bce1546f: parecer ff85a87a300676ba67f4c5c7785f18bf711ecc630f714bdc8db4069b38824341, sem bloqueante novo confirmado. Não equivale a execução no worktree/banco TESTER. Limite registrado: resolver/leitor verificam prazo JWT na entrada da rota; não reavaliam o prazo após esperas como faz a escrita. Não houve bypass demonstrado.

Regressão global original na fonte bce1546f: sessão17923/terminal0e062e EXIT1; 1.067 arquivos, 9.418 casos, 9.393 aprovados e 25 falhas em somente ConversaAberta.busca.test.ts e ConversaAberta.rodape.test.ts. Todas falharam no useId real fora do render, pois estas fixtures materializam funções com ganchos simulados e não ligavam o useId. O simulador criarGanchos já implementava useId posicional estável.

Correção R22: somente conectar esse useId aos dois mocks existentes. Produção e asserções preservadas; nenhum teste excluído. Os dois arquivos completos passaram: terminal6429fd EXIT0, 25/25. Isso não transforma a regressão global anterior em aprovação; nova regressão completa e TSC/lint/build, execução independente e visual/CI/publicação376 continuam pendentes.
