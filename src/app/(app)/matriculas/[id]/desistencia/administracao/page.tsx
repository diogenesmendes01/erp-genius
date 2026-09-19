import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarDecisaoAdministrativaDesistencia } from "@/server/matricula/desistencia-administrativa";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { DecisaoFormulario } from "./DecisaoFormulario";

function textoInstanteAdministrativo(iso: string, preferenciaFusoExibicao: string | null) {
  const exibicao = formatarInstanteExibicao(iso, preferenciaFusoExibicao, "UTC");
  return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
}

export default async function AdministracaoDesistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const preferencia = await consultarPreferenciaFusoEquipe();
  const fusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const { id } = await params;
  const resposta = await consultarDecisaoAdministrativaDesistencia({ matriculaId: id });
  if (!resposta.ok || !resposta.dado) return <p role="alert">{resposta.ok ? "Consulta indisponível." : resposta.erro}</p>;
  const d = resposta.dado;
  return <section className="space-y-5">
    <Link className="underline" href={`/matriculas/${encodeURIComponent(id)}/desistencia`}>Voltar ao pedido de desistência</Link>
    <h1 className="text-2xl font-medium">Decisão administrativa · {d.matricula.codigo ?? "Matrícula em preparação"}</h1>
    <p>A Administração decide sobre o pedido registrado por outra pessoa. A aprovação não cancela cobranças ou assinaturas e não efetiva a desistência. Os tratamentos financeiros e documentais aplicáveis continuam necessários.</p>
    {!d.exigeAprovacaoAdministrativa && <p>Os registros consultados não exigem aprovação administrativa por avanço formal. Confira os demais requisitos no pedido.</p>}
    {!!d.pendencias.length && <section className="space-y-2 rounded border p-4"><h2 className="text-lg font-medium">Condições para conferência</h2><ul className="list-disc pl-5">{d.pendencias.map((p, i) => <li key={i}>{p}</li>)}</ul></section>}
    <section className="space-y-3"><h2 className="text-lg font-medium">Pedidos e decisões</h2>
      {!d.pedidos.length && <p>Nenhum pedido de desistência registrado.</p>}
      {d.pedidos.map(p => <article key={p.id} className="space-y-3 rounded border p-4">
        <h3 className="font-medium">Versão {p.versao} · {p.registradorNome}</h3>
        <p className="whitespace-pre-wrap">{p.motivo}</p><p className="whitespace-pre-wrap">{p.evidenciaPedido}</p>
        {!p.atual && <p>As condições mudaram desde este pedido. Esta versão não pode receber nova aprovação.</p>}
        {p.decisao ? <section className="space-y-1"><p>{p.decisao.aprovada ? "Aprovado" : "Rejeitado"} por {p.decisao.decisorNome} em {textoInstanteAdministrativo(p.decisao.dataISO, fusoExibicao)}.</p><p className="whitespace-pre-wrap">{p.decisao.motivo}</p></section>
          : p.podeDecidir ? <DecisaoFormulario pedidoId={p.id} estadoHash={p.estadoHash} podeAprovar={p.podeAprovar} />
          : <p>Sem decisão registrada. Somente outra pessoa da Administração pode decidir um pedido elegível.</p>}
      </article>)}
      {d.pedidos.length === 20 && <p>Esta tela apresenta os vinte pedidos mais recentes.</p>}
    </section>
  </section>;
}
