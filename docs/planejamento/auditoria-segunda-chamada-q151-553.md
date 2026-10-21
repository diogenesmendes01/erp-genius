# Auditoria UI — autorização especial de segunda chamada

## Lacuna observada

O domínio já expõe `autorizarRealizacaoEspecialSegundaChamada` em `src/server/avaliacoes/segunda-chamada-autorizacao-especial.ts`, mas a tela da segunda chamada não oferecia uma operação de Gestão Pedagógica para registrar a autorização, informar o prazo ou consultar o histórico.

O aviso em `src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/page.tsx` indicava que uma realização com vínculo inativo exige autorização específica. Ainda assim, `SegundaChamadaPainel.tsx` não importava a ação de autorização, e `consultarSegundasChamadas` em `src/server/avaliacoes/segunda-chamada.ts` não projetava dados de autorização.

## Reprodução

Com uma segunda chamada já pendente e uma matrícula ou vínculo inativo, a Gestão Pedagógica abre a tela da avaliação. A página informa a exigência, mas não permite registrar nem conferir a autorização necessária. A realização permanece sujeita à validação de `src/server/avaliacoes/segunda-chamada-realizacao.ts`.

## Próximo passo

Após a validação da segurança e da vigência histórica no servidor/SQL, disponibilizar uma interface exclusiva da Gestão Pedagógica para autorizar a pendência e consultar seu histórico. Essa etapa não decide o alcance entre pausa e encerramento; essa decisão permanece pendente fora desta auditoria.
