import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTelaEmissao } from "@/server/secretaria/conferencia-emissao";
import { formatarMoeda } from "@/lib/dinheiro";
import { ConfirmarEmissao } from "./ConfirmarEmissao";
export default async function EmissaoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id } = await params, r = await consultarTelaEmissao(id);
  const links = <nav className="flex gap-4"><Link className="underline" href={`/matriculas/${id}/preparacao`}>Proposta e pendências</Link><Link className="underline" href={`/matriculas/${id}/pagador`}>Pagador</Link><Link className="underline" href={`/matriculas/${id}/condicoes`}>Condições de entrada</Link></nav>;
  if (!r.ok || !r.dado) return <div className="space-y-4">{links}<p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p></div>;
  const tipo = (v: string) => v === "MATRICULA" ? "Taxa de matrícula" : v === "MENSALIDADE" ? "Primeira mensalidade" : "Adiantamento por hora";
  if (r.dado.estado === "EMITIDA") {
    const c = r.dado.registro;
    return <div className="space-y-4">{links}<h1 className="text-2xl">Emissão inicial registrada</h1><p>Conferida por {c.autor.nome} em {c.criadaEm.toISOString()} (UTC).</p><p>{c.motivo}</p><ul>{c.cobrancas.map((b) => <li key={b.id}>{tipo(b.tipo)} · {formatarMoeda(Number(b.valor), b.moeda)} · Vencimento {b.vencimento}</li>)}</ul><p>Estes são os valores originalmente emitidos. A confirmação do recebimento e eventuais ajustes são acompanhados no Financeiro. A emissão não ativa a matrícula.</p><Link className="underline" href="/financeiro">Abrir Financeiro</Link>{r.dado.particular && <Link className="block underline" href={`/matriculas/${encodeURIComponent(id)}/entrada-particular`}>Conferir pagamentos de entrada da particular</Link>}</div>;
  }
  const v = r.dado.revisao, a = v.dados.aluno, p = v.dados.pagador;
  return <div className="space-y-5">{links}<h1 className="text-2xl">Conferência para emissão inicial</h1>
    <section className="rounded border p-4"><h2 className="text-xl">Aluno</h2><p>{a.primeiroNome} {a.sobrenome}</p><p>Documento: {a.documento || "Não informado"}</p><p>{a.email || "E-mail não informado"} · {a.telefoneE164 || "Telefone não informado"}</p><p>{[a.rua, a.numero, a.cidade, a.regiao, a.cep, a.paisResidencia].filter(Boolean).join(", ") || "Endereço não informado"}</p></section>
    <section className="rounded border p-4"><h2 className="text-xl">Pagador · versão {p.versao}</h2><p>{p.dados.nome} · {p.tipo === "ALUNO" ? "Próprio aluno" : p.tipo === "EMPRESA" ? "Empresa" : "Responsável"}</p><p>Documento: {p.dados.documento || "Não informado"}</p><p>{p.dados.email || "E-mail não informado"} · {p.dados.telefoneE164 || "Telefone não informado"}</p><p>{p.dados.endereco || "Endereço não informado"}</p></section>
    <section><h2 className="text-xl">Documentos anexados à matrícula</h2>{v.dados.documentos.length ? <ul>{v.dados.documentos.map((d) => <li key={d.id}>{d.url.startsWith("/api/files/") || /^https?:\/\//.test(d.url) ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="underline">{d.nome}</a> : d.nome}</li>)}</ul> : <p>Nenhum documento anexado. Confira os dados e documentos necessários antes de confirmar.</p>}</section>
    {v.dados.agendaParticular && <section className="rounded border p-4"><h2 className="text-xl">Horários particulares reservados</h2><p className="whitespace-pre-line">{v.dados.agendaParticular}</p></section>}
    {!!v.avisos.length && <ul className="list-disc pl-5" aria-label="Avisos de conferência">{v.avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}</ul>}
    <section><h2 className="text-xl">Cobranças previstas · condições versão {v.dados.versaoCondicoes}</h2><ul>{v.plano.map((c) => <li key={c.tipo}>{tipo(c.tipo)} · {formatarMoeda(Number(c.valor), c.moeda)} · Vencimento {c.vencimento} · {c.etapa === "CONFERENCIA_SECRETARIA" ? "Será emitida nesta confirmação" : "Será emitida na ativação"}{c.cobertura ? ` · Cobertura ${c.cobertura.inicio} a ${c.cobertura.fim}` : ""}{c.minutos ? ` · ${c.minutos} minutos` : ""}</li>)}</ul></section>
    <p>A confirmação cria somente as cobranças desta etapa. Não confirma pagamento, assinatura ou ativação. A disponibilidade será conferida novamente antes da emissão.</p>
    <ConfirmarEmissao key={v.hash} matriculaId={id} revisaoHash={v.hash} />
  </div>;
}
