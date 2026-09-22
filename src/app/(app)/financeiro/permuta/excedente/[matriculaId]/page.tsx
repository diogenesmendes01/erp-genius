import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarDestinacoesExcedentePermuta } from "@/server/matricula/excedente-permuta-destinacao";
import { consultarUsosSaldoServicoPermuta } from "@/server/matricula/saldo-servico-permuta-uso";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { ExcedenteFormulario } from "./Formulario";

const PARTES: Record<string, string> = { ALUNO_OU_RESPONSAVEL: "Aluno ou responsável", ESCOLA: "Escola" };

export default async function Pagina({ params }: { params: Promise<{ matriculaId: string }> }) {
 await exigirSessaoPagina(Papel.FINANCEIRO);
 const { matriculaId } = await params;
 const [r, usos, preferencia] = await Promise.all([consultarDestinacoesExcedentePermuta({ matriculaId }), consultarUsosSaldoServicoPermuta({ matriculaId }), consultarPreferenciaFusoEquipe()]);
 if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível" : r.erro}</p>;
 if (!usos.ok || !usos.dado) return <p role="alert">{usos.ok ? "Consulta indisponível" : usos.erro}</p>;
 const d = r.dado, u = usos.dado;
 const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
 const instante = (valor: string) => { const e = formatarInstanteExibicao(valor, fusoExibicao, "UTC"); return `${e.texto} (horário exibido em ${e.fuso}; origem UTC)`; };
 return <main className="space-y-5"><Link href="/financeiro/permuta" className="underline">Voltar às permutas</Link>
 <h1 className="text-2xl">Excedente de permuta · destinação negociada</h1>
 <p>Matrícula {matriculaId}</p>
 <section className="space-y-2 rounded border p-4"><h2 className="text-xl">Como funciona</h2>
  <p>Quando a obrigação acordada fica menor do que o serviço já compensado, o excedente não vira crédito nem devolução sozinho. O Financeiro propõe a destinação, o aluno (ou responsável) e a escola registram concordância, e outra pessoa do Financeiro decide.</p>
  <p>Saldo restrito a serviços abate cobranças desta mesma matrícula por proposta e aprovação próprias, não expira e nunca vira dinheiro. Crédito financeiro segue as regras gerais de crédito da matrícula, na mesma moeda.</p>
 </section>
 <h2 className="text-xl">Cobranças compensadas por permuta</h2>
 {!d.cobrancas.length && <p>Nenhuma cobrança desta matrícula foi compensada por permuta.</p>}
 {d.cobrancas.map(c => <section key={c.id} className="space-y-2 rounded border p-4">
  <h3>{c.tipo} · vencimento {instante(c.vencimento)} · {c.status}</h3>
  <p>Cobrança {c.id} · versão {c.versao} · negociado {c.valorNegociado} {c.moeda} · liquidado {c.liquidado} {c.moeda} (permuta {c.permuta} {c.moeda})</p>
  {c.fontes.origens.length > 0 && <ul className="list-disc pl-5">{c.fontes.origens.map(o => <li key={o.id}>{o.tipo} · {o.valor} {c.moeda} · origem {o.id}</li>)}</ul>}
  {c.destinada ? <p role="status">Esta cobrança já possui destinação de excedente aprovada.</p>
   : c.emAndamento ? <p role="status">Há destinação aguardando decisão (veja abaixo).</p>
   : !c.fontes.prontas ? <p role="status">As fontes de liquidação ainda não são finais: {c.fontes.pendencias.join(", ")}.</p>
   : <ExcedenteFormulario modo="preparar" matriculaId={matriculaId} cobrancaId={c.id} moeda={c.moeda} origens={c.fontes.origens} />}
 </section>)}
 <h2 className="text-xl">Destinações propostas</h2>
 {!d.propostas.length && <p>Nenhuma destinação registrada.</p>}
 {d.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
  <h3>Proposta {p.id} · {p.estado}</h3>
  <p>Cobrança {p.cobrancaId} · obrigação acordada {p.valorDevidoAcordado} {p.moeda} · excedente {p.valorExcedente} {p.moeda} · preparada por {p.preparador} em {instante(p.criadaEm)}</p>
  <p>Motivo: {p.motivo}</p>
  <ul className="list-disc pl-5">{p.itens.map(i => <li key={i.tipo}>{i.tipo === "SALDO_SERVICOS" ? "Saldo restrito a serviços" : "Crédito financeiro"}: {i.valor} {p.moeda}</li>)}</ul>
  <h4>Concordâncias</h4>
  {p.concordancias.map(k => <p key={k.parte}>{PARTES[k.parte]}: {k.nomeDeclarante}, por {k.meio}, em {instante(k.registradaEm)}. Evidência: {k.evidencia}</p>)}
  {p.estado === "PENDENTE" && p.partesPendentes.map(parte => <ExcedenteFormulario key={parte} modo="concordar" propostaId={p.id} parte={parte} />)}
  {p.decisao && <p>Decisão em {instante(p.decisao.decididaEm)}: {p.decisao.motivo}</p>}
  {p.podeDecidir && <ExcedenteFormulario modo="decidir" propostaId={p.id} />}
 </section>)}
 <h2 className="text-xl">Saldos restritos a serviços</h2>
 {!u.saldos.length && <p>Nenhum saldo de serviços nesta matrícula.</p>}
 {u.saldos.map(s => <section key={s.id} className="space-y-2 rounded border p-4">
  <h3>Saldo {s.id} · criado em {instante(s.criadoEm)}</h3>
  <p>Inicial {s.valorInicial} {s.moeda} · usado {s.usadoAprovado} {s.moeda} · disponível {s.disponivel} {s.moeda}. Não expira e nunca vira dinheiro; abate mensalidade, hora particular ou taxa em aberto desta matrícula, na mesma moeda.</p>
  {s.cobrancasAbativeis.length > 0
   ? <ExcedenteFormulario modo="usar" saldoId={s.id} moeda={s.moeda} disponivel={s.disponivel} cobrancas={s.cobrancasAbativeis} />
   : <p role="status">{Number(s.disponivel) > 0 ? "Nenhuma cobrança em aberto abatível no momento (ou há uso aguardando decisão)." : "Saldo totalmente utilizado."}</p>}
 </section>)}
 <h2 className="text-xl">Usos do saldo de serviços</h2>
 {!u.propostas.length && <p>Nenhum uso registrado.</p>}
 {u.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
  <h3>Uso {p.id} · {p.estado}</h3>
  <p>Cobrança {p.cobrancaId} · {p.valor} {p.moeda} · saldo {p.saldoId} · proposto por {p.preparador} em {instante(p.criadaEm)}</p>
  <p>Motivo: {p.motivo}</p>
  {p.decisao && <p>Decisão em {instante(p.decisao.decididaEm)}: {p.decisao.motivo}{p.decisao.aplicacaoId && <> · aplicação {p.decisao.aplicacaoId}</>}</p>}
  {p.podeDecidir && <ExcedenteFormulario modo="decidir-uso" propostaId={p.id} />}
 </section>)}
 </main>;
}
