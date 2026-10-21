import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarDestinacoesExcedentePermuta } from "@/server/matricula/excedente-permuta-destinacao";
import { consultarUsosSaldoServicoPermuta } from "@/server/matricula/saldo-servico-permuta-uso";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { consultarCabecalhoMatricula } from "@/server/matricula/cabecalho";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro";
import { formatarDataCivil } from "@/lib/data-civil";
import { formatarMoeda } from "@/lib/dinheiro";
import { ESTADO_PROPOSTA_DECIDIDA_LABEL, STATUS_COBRANCA_LABEL, TIPO_COBRANCA_LABEL, rotular } from "@/lib/labels";
import { ExcedenteFormulario } from "./Formulario";

const PARTES: Record<string, string> = { ALUNO_OU_RESPONSAVEL: "Aluno ou responsável", ESCOLA: "Escola" };
const PENDENCIAS: Record<string, string> = {
 INFORME_PAGAMENTO_A_CONFERIR: "comprovante a conferir",
 PROPOSTA_USO_CREDITO_A_DECIDIR: "uso de crédito aguardando decisão",
 CREDITO_ANTERIOR_SEM_ATRIBUICAO_POR_ORIGEM: "crédito anterior sem atribuição por origem",
};

/** Q171/Q167C: destinação negociada do excedente de permuta e uso do saldo restrito a serviços, por matrícula. */
export default async function Pagina({ params }: { params: Promise<{ matriculaId: string }> }) {
 const usuario = await exigirSessaoPagina(Papel.FINANCEIRO);
 const { matriculaId } = await params;
 const [r, usos, preferencia, cabecalho] = await Promise.all([
  consultarDestinacoesExcedentePermuta({ matriculaId }), consultarUsosSaldoServicoPermuta({ matriculaId }), consultarPreferenciaFusoEquipe(), consultarCabecalhoMatricula(usuario, matriculaId),
 ]);
 if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível" : r.erro}</p>;
 if (!usos.ok || !usos.dado) return <p role="alert">{usos.ok ? "Consulta indisponível" : usos.erro}</p>;
 const d = r.dado, u = usos.dado;
 const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
 const instante = (valor: string) => { const e = formatarInstanteExibicao(valor, fusoExibicao, "UTC"); return `${e.texto} (horário exibido em ${e.fuso}; origem UTC)`; };
 const cobrancaPorId = new Map(d.cobrancas.map(c => [c.id, c]));
 const rotuloCobranca = (cobrancaId: string) => { const c = cobrancaPorId.get(cobrancaId); return c ? `${rotular(TIPO_COBRANCA_LABEL, c.tipo)} com vencimento em ${formatarDataCivil(c.vencimento)}` : "Cobrança"; };
 return <main className="space-y-5"><VoltarPara href="/financeiro/permuta" />
 <h1 className="text-2xl">Excedente de permuta · destinação negociada</h1>
 {cabecalho && <IdentificacaoRegistro rotulo="Aluno e matrícula" dados={{ aluno: cabecalho.aluno, alunoHref: `/alunos/${encodeURIComponent(cabecalho.alunoId)}`, matriculaCodigo: cabecalho.codigo, matriculaComplemento: cabecalho.produto }} />}
 <section className="space-y-2 rounded border p-4"><h2 className="text-xl">Como funciona</h2>
  <p>Quando a obrigação acordada fica menor do que o serviço já compensado, o excedente não vira crédito nem devolução sozinho. O Financeiro propõe a destinação, o aluno (ou responsável) e a escola registram concordância, e outra pessoa do Financeiro decide.</p>
  <p>Saldo restrito a serviços abate mensalidade desta mesma matrícula (hora particular e taxa exigem conferência financeira específica), por proposta e aprovação próprias; não expira e nunca vira dinheiro, nem no encerramento ou na desistência. Crédito financeiro segue as regras gerais de crédito da matrícula, na mesma moeda.</p>
 </section>
 <h2 className="text-xl">Cobranças compensadas por permuta</h2>
 {!d.cobrancas.length && <EstadoVazio bloco>Nenhuma cobrança desta matrícula foi compensada por permuta.</EstadoVazio>}
 {d.cobrancas.map(c => <section key={c.id} className="space-y-2 rounded border p-4">
  <h3>{rotular(TIPO_COBRANCA_LABEL, c.tipo)} · vencimento {formatarDataCivil(c.vencimento)} · {rotular(STATUS_COBRANCA_LABEL, c.status)}</h3>
  <p>Negociado {formatarMoeda(c.valorNegociado, c.moeda)} · liquidado {formatarMoeda(c.liquidado, c.moeda)} (serviço compensado {formatarMoeda(c.permuta, c.moeda)})</p>
  {c.fontes.origens.length > 0 && <ul className="list-disc pl-5">{c.fontes.origens.map(o => <li key={o.id}>{o.tipo === "PERMUTA" ? (o.usoSaldo ? "Serviço (uso do saldo de serviços)" : "Serviço (permuta)") : o.tipo === "CAIXA" ? "Caixa" : "Crédito"}: {formatarMoeda(o.valor, c.moeda)}</li>)}</ul>}
  {c.destinada ? <p role="status">Esta cobrança já possui destinação de excedente aprovada.</p>
   : c.emAndamento ? <p role="status">Há destinação aguardando decisão (veja abaixo).</p>
   : !c.quitada ? <p role="status">A cobrança ainda está em aberto: a destinação do excedente só vale para cobrança quitada.</p>
   : !c.fontes.prontas ? <p role="status">As fontes de liquidação ainda não são finais: {c.fontes.pendencias.map(x => PENDENCIAS[x] ?? x).join(", ")}.</p>
   : !c.fontes.origens.some(o => o.tipo === "PERMUTA" && !o.usoSaldo) ? <p role="status">O serviço compensado nesta cobrança veio do saldo de serviços, que não gera excedente: saldo restrito nunca vira crédito financeiro nem saldo novo.</p>
   : <ExcedenteFormulario modo="preparar" matriculaId={matriculaId} cobrancaId={c.id} moeda={c.moeda} origens={c.fontes.origens} />}
 </section>)}
 <h2 className="text-xl">Destinações propostas</h2>
 {!d.propostas.length && <EstadoVazio bloco>Nenhuma destinação registrada.</EstadoVazio>}
 {d.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
  <h3>Proposta de {instante(p.criadaEm)} · {rotular(ESTADO_PROPOSTA_DECIDIDA_LABEL, p.estado)}</h3>
  <p>{rotuloCobranca(p.cobrancaId)} · obrigação acordada {formatarMoeda(p.valorDevidoAcordado, p.moeda)} · excedente {formatarMoeda(p.valorExcedente, p.moeda)} · preparada por {p.preparador}</p>
  <p>Motivo: {p.motivo}</p>
  <ul className="list-disc pl-5">{p.itens.map(i => <li key={i.tipo}>{i.tipo === "SALDO_SERVICOS" ? "Saldo restrito a serviços" : "Crédito financeiro"}: {formatarMoeda(i.valor, p.moeda)}</li>)}</ul>
  <h4>Concordâncias</h4>
  {p.concordancias.map(k => <p key={k.parte}>{PARTES[k.parte]}: {k.nomeDeclarante}, por {k.meio}, em {instante(k.registradaEm)}. Evidência: {k.evidencia}</p>)}
  {p.estado === "PENDENTE" && p.partesPendentes.map(parte => <ExcedenteFormulario key={parte} modo="concordar" propostaId={p.id} parte={parte} />)}
  {p.decisao && <p>Decisão em {instante(p.decisao.decididaEm)}: {p.decisao.motivo}</p>}
  {p.podeDecidir && <ExcedenteFormulario modo="decidir" propostaId={p.id} />}
 </section>)}
 <h2 className="text-xl">Saldos restritos a serviços</h2>
 {!u.saldos.length && <EstadoVazio bloco>Nenhum saldo de serviços nesta matrícula.</EstadoVazio>}
 {u.saldos.map(s => <section key={s.id} className="space-y-2 rounded border p-4">
  <h3>Saldo criado em {instante(s.criadoEm)}</h3>
  <p>Inicial {formatarMoeda(s.valorInicial, s.moeda)} · usado {formatarMoeda(s.usadoAprovado, s.moeda)} · disponível {formatarMoeda(s.disponivel, s.moeda)}. O que não for usado permanece registrado como saldo não utilizado.</p>
  {s.cobrancasAbativeis.length > 0
   ? <ExcedenteFormulario modo="usar" saldoId={s.id} moeda={s.moeda} disponivel={s.disponivel} cobrancas={s.cobrancasAbativeis.map(c => ({ id: c.id, rotulo: rotular(TIPO_COBRANCA_LABEL, c.tipo), saldo: c.saldo, vencimento: c.vencimento }))} />
   : Number(s.disponivel) > 0 ? <EstadoVazio bloco>Nenhuma cobrança em aberto abatível agora (ou há uso aguardando decisão, cobrança em pausa ou comprovante a conferir).</EstadoVazio>
   : <EstadoVazio bloco>Saldo totalmente utilizado.</EstadoVazio>}
 </section>)}
 <h2 className="text-xl">Usos do saldo de serviços</h2>
 {!u.propostas.length && <EstadoVazio bloco>Nenhum uso registrado.</EstadoVazio>}
 {u.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
  <h3>Uso proposto em {instante(p.criadaEm)} · {rotular(ESTADO_PROPOSTA_DECIDIDA_LABEL, p.estado)}</h3>
  <p>{rotular(TIPO_COBRANCA_LABEL, p.cobrancaTipo)} com vencimento em {formatarDataCivil(p.cobrancaVencimento)} · {formatarMoeda(p.valor, p.moeda)} · proposto por {p.preparador}</p>
  <p>Motivo: {p.motivo}</p>
  {p.decisao && <p>Decisão em {instante(p.decisao.decididaEm)}: {p.decisao.motivo}{p.decisao.aplicacaoId ? " · abatido na cobrança como serviço compensado" : ""}</p>}
  {p.podeDecidir && <ExcedenteFormulario modo="decidir-uso" propostaId={p.id} />}
 </section>)}
 </main>;
}
