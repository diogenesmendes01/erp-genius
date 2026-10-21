# Incremento 576 — contrato de entrada da remarcação

Formalizada a SPEC `docs/specs/remarcacao-segunda-chamada.md` com fontes Q21/Q146–Q149, revisão independente, preservação de reserva/histórico, prazo sem reinício e aplicação atômica. O desenho não introduz troca de professor por campo implícito nem resolve Q164.

Implementados schemas estritos para proposta e decisão, validação de fuso e calendário, normalização de instantes UTC e hash canônico. O hash independe do relógio para permitir comparar reenvio histórico; o normalizador de nova proposta exige início futuro e intervalo ordenado. Não há acesso ao banco nem autorização de aplicação nesses helpers.

Cinco unitários e lint aprovados: `docs/validacao-remarcacao-schema-576-2026-09-15.json`. Casos incluem offsets equivalentes, meia-noite, data inválida, fim igual, passado, campo extra de professor, fuso inválido e comparação histórica sem liberar nova proposta passada.

Persistência, revisão transacional, guardas SQL, aprovação/aplicação, tela e integrações da remarcação ainda não estão implementadas. Não declarar o fluxo entregue por esta etapa. A suíte global de integração 574 continua na sessão 83089; nenhum teste de banco paralelo foi iniciado e nenhuma fonte existente dessa execução foi modificada nesta etapa.
