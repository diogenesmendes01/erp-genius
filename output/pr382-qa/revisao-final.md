# PR382 — B1 e C1/C2/C3

B1 e sua prova real estão em revisao-b1.md/ui.json, fonte d5bfa237. O delta seguinte adiciona leitura no retorno da aba visível (listener com cleanup, sem polling), mantém a thread oculta sem leitura, e remove a segunda invalidação da ação composta no servidor. Leitura pessoal isolada e invalidação após falha parcial são preservadas.

TDD: C1 dec1c2 exit1 com2falhas/25passes por listener ausente. C2 integração621b4c exit1: teste escolhido observou2revalidações;6testes fora do filtro, não suíte completa. Depois: unitário dirigido361eea exit0/4arquivos43testes; integração exclusiva ci-integracao73209 exit0/2arquivos15testes, semfiltro/ignorados dentro desses arquivos (`preferencias.int.test.ts` e `motor/presenca.int.test.ts`). Cobre escopo, preferências pessoais, contador compartilhado, capacidade do motor, invalidação única e falha parcial.

Gates da fonte final, Node22.23.2: suíte UNITÁRIA COMPLETA23477 exit0/840arquivos6485testes, semfiltro/ignorados/maxWorkers2; TypeScript1446 heap8192 exit0; eslint global2057 exit0,0erros40avisos herdados. Não atribuir a essa fonte os6483testes anteriores ao deltaC1/C2. Banco e servidor da revisão separados dos DEVs do chat coordenador, sem transporte real ou outra integração externa.

C3: as duas integrações solicitadas foram executadas na fonte final, no banco fechado ci-integracao. Não é suíte completa de integração nem se afirma que rodaram naCI do GitHub. C5 permanece gate de publicação: retarget para main somente depois da381 e confirmar checks reais. A aprovação da correção pelo revisor ainda é necessária; nenhum merge382 presumido.
