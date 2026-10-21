# Incremento 408 — painel operacional e interrupções após prorrogação

2026-09-14. Painel da gestão integrado às reposições por matrícula: consulta de material, prorrogação de etapa, liberação pontual, confirmação e retomada de indisponibilidade. Somente Gestão Pedagógica/Administração consulta essas operações; Secretaria não dispara consultas proibidas por item. Falhas aparecem na interface sem detalhes internos. Conta do portal é derivada no servidor na liberação.

O cálculo de prazo agora usa a última prorrogação e seu instante de autorização. Interrupções posteriores ampliam esse prazo; o trecho anterior já incorporado à autorização não é contado novamente. A migration `20260915017000_prazo_cronologico_reposicao` aplica a mesma regra ao controle SQL, preservando a migration 190.

## Verificação

- Teste regressivo de interrupção após prorrogação falhou com o SQL190 e passou após integrar SQL191.
- Primeira rodada do painel: 2/4. A consulta usava a assinatura antiga do helper e um wrapper lançava exceção sem retornar o resultado esperado pela tela. Corrigidos; rodada seguinte 4/4.
- Regressão integrada final: **25/25**, quatro arquivos, incluindo seis testes operacionais. Relatório: `docs/validacao-portal-408-integrado-2026-09-14.json`.
- Dez testes unitários de prazos/etapas passaram. TypeScript passou. Prisma diff contra banco descartável retornou vazio.
- O build completo anterior consta no incremento 407. Não foi repetido após todos estes ajustes; não há validação visual do painel.

## Pendências preservadas

Q57 ainda precisa de relato pela equipe/professor e descarte explícito de relato improcedente, em implementação. Publicação de material pelo painel requer teste próprio. Reprodução autenticada Drive e demais frentes da SPEC seguem pendentes. Não houve implantação nem alteração de produção.
