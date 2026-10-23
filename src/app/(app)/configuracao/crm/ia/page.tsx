import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { painelIA } from "@/server/crm-config/ia";
import { IaPainel } from "./IaPainel";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { fusoDaEscola } from "@/server/relatorios/atendimento";

export default async function Pagina() {
  await exigirSessaoPagina(Papel.ADMINISTRADOR);
  const [p, preferencia, fusoEscola] = await Promise.all([painelIA(), consultarPreferenciaFusoEquipe(), fusoDaEscola()]);
  const { config } = p;
  return (
    <section aria-labelledby="titulo-secao">
      <h2 id="titulo-secao" className="text-lg font-semibold">IA</h2>
      <p className="mt-1 text-sm text-gray-600">Provedor, modelo por tarefa, orçamento mensal e triagem. Só o administrador altera.</p>
      <IaPainel
        chave={p.chave}
        config={{
          modeloConversa: config.modeloConversa, modeloClassificacao: config.modeloClassificacao,
          orcamentoMensalUsd: Number(config.orcamentoMensalUsd), acaoAoEstourar: config.acaoAoEstourar,
          triagemAtiva: config.triagemAtiva, limiarTriagem: config.limiarTriagem,
        }}
        orcamento={{ situacao: p.orcamento.situacao, gastoUsd: p.orcamento.gastoUsd, limiteUsd: p.orcamento.limiteUsd }}
        chamadas={p.chamadas}
        fusoExibicao={resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, fusoEscola)}
      />
    </section>
  );
}
