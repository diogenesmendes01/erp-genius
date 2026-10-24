# PR #417 — disposições R1

Revisão5638982397 no head29b23763. Correção local sobre a mesma base main239, sem backend/schema/dependências. Não é merge nem homologação.

- **B1:** identidade do DTO separada da versão/tentativa de aquisição. Mesma conversa/aba conserva o último DTO bom enquanto recarrega, inclusive falha500/rede/JSON. Resposta antiga perde autoridade pelo cleanup/AbortSignal. Troca de ID/aba ou desativação limpa imediatamente, inclusive A→B→A. Negativa explícita403/404 revoga o snapshot; não é tratada como falha transitória. Um teste da composição real aciona `atendimento.atualizado` e verifica o mesmo nó de link/foco durante a aquisição e após500.
- **C1:** comercial sem Pessoa conserva o telefone já autorizado no item do atendimento, sem fabricar perfil ou consultar dados adicionais. Ausência de telefone permanece ausência. Fora do comercial a regra existente continua; não há alteração de permissões ou do filtro pedagógico do servidor.
- **C2:** [ZIP36 e PNG B2B publicados diretamente na PR](https://github.com/diogenesmendes01/erp-genius/pull/417#issuecomment-6386805037), após autorização do dono. Corpus nominal APPddf/harness96c, sem reatribuir recaptura à R1.
- **C3:** rótulo genérico Documento da empresa já registrado na SPEC, seção Ajuste LATAM, com RUT chileno; documento/nascimento da Pessoa são a #340. O quadro preserva a mesma decisão.
- **C4:** callback `aoAbrirOportunidades` pertence à #327 e já existe no código congelado6b2f daquela frente. A #325 mantém o destino Funil permitido no seu próprio escopo; não transporta a implementação327.
- **C5:** a ausência de CPF/Idade já era explícita no teste B2C: `for (const s of ["/mês", "CPF", "Idade", "Preferências"]) expect(h).not.toContain(s);`, linha22 no head29b. O caso sem Pessoa verifica ausência de perfil/link de ficha. A rastreabilidade é descrita na SPEC, sem duplicar asserts equivalentes.

Provas ROOT: RED58d5bd, dois arquivos completos/24 casos, seis falhas causais/18 positivos. GREEN final e lint4 `e76b84`, três arquivos completos/33 testes,2,39s,maxWorkers1,sem filtro por nome/skips, zero avisos. TypeScript final71274/3f8f09, saída0,heap8192,incrementalfalse. Os testes de apresentação existentes incluem C3/C5. Recortes não são suíte global.

A primeira forma intermediária acionou a regra set-state-in-effect; o código final representa o erro pela chave da aquisição e não atualiza estado sincronamente no efeito. Global63523/e7e192 e TSC5623/ec8ae1 foram interrompidos antes de editar essa forma e não contam como gates. Regressão global final21939/026749: saída0,926 arquivos/7.309 testes,236,42s,maxWorkers2,sem filtro de casos/skips; configuração unitária exclui INT.

Sete pareceres anteriores continuam nominais às suas fontes; nova QA independente da R1 e CI no novo head ainda pendentes. Sem nova captura, HTTP, banco, nota, Save, mensagem externa ou deploy nesta correção.
