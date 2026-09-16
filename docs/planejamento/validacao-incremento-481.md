# Incremento 481 — estabilização do ambiente e resultado da regressão

Data: 15/09/2026. Turno anterior teve progresso em regras Q116, testes e recuperação do manifesto. Meta integral ativa.

## Resultado terminal da regressão 479

A sessão `29713` terminou com código 1: 902 testes aprovados, 46 falhas, 74 arquivos aprovados e 12 com falhas; um worker saiu inesperadamente. O relatório contabiliza 86 arquivos, enquanto a seleção contém 87. Preservados `docs/validacao-integracao-ampla-479-2026-09-15.json` e `.log`.

Falhas abrangem progressão/fechamento, visibilidade, cadastro, acesso às aulas, comprovantes, impactos de avaliações, regras de turma, diário, regularização docente, Secretaria, ativação e ciclo de cobrança WhatsApp. A mudança de dependências durante a execução impede tratá-la como validação final. Não atribuir todas as falhas ao ambiente sem repetir os casos e investigar o código.

## Ambiente recuperado e prevenção

A inspeção inicial de caminhos do lockfile encontrou 123 diferenças, muitas por dependências opcionais de outras plataformas. Cinco divergências reais de versões diretas foram confirmadas: icons-react, react-hook-form, autoprefixer, eslint e tsx. A ausência de dois caminhos transitivos pode refletir a estrutura do gerenciador e não foi classificada isoladamente como defeito. Inventário: `docs/dependencias-conferencia-481-2026-09-15.json`.

Implementado `src/test/dependencias.ts`, consumido pelo setup de integração antes de qualquer migration. Confere manifesto/lockfile e versões instaladas das dependências diretas, incluindo ferramentas; não instala nem altera o ambiente. Quatro testes verificam correspondência, atualização dentro do intervalo, manifesto divergente e ferramenta ausente. Relatório `docs/validacao-dependencias-481-2026-09-15.json`. Execução no ambiente divergente recusou exatamente os cinco pacotes identificados.

Depois do término da regressão, a parada normal do banco de testes atingiu timeout. Processo e diretório foram conferidos como o cluster descartável deste workspace. `pg_ctl stop -m immediate` concluiu sua parada. `npm ci --no-audit --no-fund` terminou com sucesso (600 pacotes), conforme `docs/restauracao-dependencias-481-2026-09-15.log`; Prisma Client regenerado. A conferência das dependências diretas passou após a reinstalação. Nenhum dado de produção foi acessado ou apagado.

## Validação estável e banco em recuperação

A suíte unitária completa no ambiente reinstalado passou: **954 testes**, relatório `docs/validacao-unitarios-estavel-481-2026-09-15.json`. TypeScript e lint das alterações também passaram antes da reinstalação.

O reinício do PostgreSQL iniciou recuperação automática após a parada imediata. A sessão do script `88196` terminou por timeout de espera, mas o servidor continua vivo: PID 46204 e processo de recuperação PID 21008, com avanço de LSN observado no log. Não tratar o timeout do pg_ctl como encerramento do servidor e não reiniciar novamente apenas por isso. Acompanhar `node_modules/.cache/erp-genius-tests/postgres.log` e testar prontidão somente no endereço fixo localhost:54329/erp_genius_test.

## Próximos passos e limites

Após o banco concluir a recuperação, repetir os 12 arquivos com falhas em um único processo e corrigir causas reais antes da nova regressão completa. O teste de regularização pode ter sido afetado pela perda do worker; o arquivo não contabilizado também precisa ser identificado. Q116 ainda exige persistência, decisões, cancelamento externo e integração do substituto; a revisão de campos foi concluída sem editar schema durante a regressão. Sem nova migration, deploy ou comprovação de conclusão da SPEC integral.
