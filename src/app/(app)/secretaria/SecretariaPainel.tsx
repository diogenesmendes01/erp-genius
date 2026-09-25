"use client";
import Link from "next/link";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CategoriaDocumento } from "@prisma/client";
import { UploadArquivo } from "@/components/UploadArquivo";
import { arquivarDocumentoLead } from "@/server/comercial/acoes";
import { assumirMatricula, solicitarCorrecaoCadastro, resolverCorrecaoCadastro, confirmarContratoMatricula, anexarDocumentoMatricula, arquivarDocumentoMatricula } from "@/server/secretaria/acoes";
import { concluirMatricula } from "@/server/matricula/acoes";
import { conferirCoberturaInicial } from "@/server/secretaria/cobertura";
import { formatarMoeda } from "@/lib/dinheiro";
import { STATUS_MATRICULA_LABEL, rotular } from "@/lib/labels";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { EstadoVazio } from "@/components/EstadoVazio";

type Matricula = { exigeAssinaturaIntegrada: boolean; mensalidadesExibidas: { id: string; versao: number; valor: string; moeda: string; inicio: string | null; fim: string | null; vencimento: string }[]; cobertura: { cobrancaId: string | null; versao: number | null; vencimento: string | null; referencia: string | null; inicio: string | null; fim: string | null }; id: string; codigo: string | null; leadId: string | null; alunoId: string | null; nome: string; status: string; assumida: boolean; contratoConfirmado: boolean; documentos: { id: string; nome: string; categoria: string; matriculaId: string | null; url: string }[]; correcoes: { id: string; campo: string; valorProposto: string | null; motivo: string; status: string; motivoResolucao: string | null }[] };
const campos = { primeiroNome: "Primeiro nome", sobrenome: "Sobrenome", nomePreferido: "Nome preferido", email: "E-mail", telefoneE164: "Telefone com DDI", documentos: "Documento (descreva a correção)" };
type Campo = keyof typeof campos;
const estilo = "rounded border border-gray-300 p-2 text-sm";

export function SecretariaPainel({ secretaria, matriculas }: { secretaria: boolean; matriculas: Matricula[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [categorias, setCategorias] = useState<Record<string, CategoriaDocumento>>({});
  async function executar(operacao: () => Promise<{ ok: boolean; erro?: string }>) { setErro(null); setOcupado(true); try { const r = await operacao(); if (!r.ok) setErro(r.erro ?? "Operação não concluída."); else router.refresh(); } catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); } finally { setOcupado(false); } }
  function pedir(e: FormEvent<HTMLFormElement>, matriculaId: string) { e.preventDefault(); const f = new FormData(e.currentTarget); void executar(() => solicitarCorrecaoCadastro({ matriculaId, campo: String(f.get("campo")) as Campo, valorProposto: String(f.get("valor")), motivo: String(f.get("motivo")) })); }
  function resolver(e: FormEvent<HTMLFormElement>, id: string) { e.preventDefault(); const f = new FormData(e.currentTarget); void executar(() => resolverCorrecaoCadastro(id, { aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")), documentoId: String(f.get("documentoId") ?? "") || undefined })); }
  function confirmar(e: FormEvent<HTMLFormElement>, id: string) { e.preventDefault(); const f = new FormData(e.currentTarget); void executar(() => confirmarContratoMatricula(id, String(f.get("documentoId")), matriculas.find((m) => m.id === id)!.mensalidadesExibidas.map(({ id, versao }) => ({ id, versao })))); }
  return <div className="space-y-4">
    {erro && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    {!matriculas.length && <EstadoVazio>Nenhuma matrícula no seu escopo.</EstadoVazio>}
    {matriculas.map((m) => <article key={m.id} className="space-y-3 rounded-lg border p-4">
      <Link className="text-sm underline" href={`/matriculas/${m.id}/preparacao`}>Revisar proposta comercial</Link>
      {secretaria && <>
      <Link className="text-sm underline" href={`/matriculas/${m.id}/pagador`}>Conferir pagador desta matrícula</Link>
      <Link className="text-sm underline" href={`/matriculas/${m.id}/condicoes`}>Conferir condições de entrada</Link>
      <Link className="text-sm underline" href={`/matriculas/${m.id}/emissao`}>Conferir e emitir cobranças iniciais</Link>
      <Link className="text-sm underline" href={`/matriculas/${m.id}/contrato`}>Preparar e consultar prévias contratuais</Link>
      <Link className="text-sm underline" href={`/matriculas/${m.id}/autorizacoes-comunicacao`}>Gerir destinatários acadêmicos</Link>
      </>}
      <Link className="text-sm underline" href={`/matriculas/${m.id}/reserva`}>Consultar ou reservar vaga</Link>
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-medium">{m.codigo ?? "Matrícula"} · {m.nome}</h2>{m.alunoId && <a className="text-sm text-brand-700" href={`/alunos/${m.alunoId}`}>Abrir cadastro do aluno</a>}</div>
      {secretaria && <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="pb-2 text-left font-medium">Mensalidades para conferência contratual</caption>
          <thead><tr><th scope="col" className="p-2">Período coberto</th><th scope="col" className="p-2">Vencimento</th><th scope="col" className="p-2">Valor contratado</th></tr></thead>
          <tbody>{m.mensalidadesExibidas.map((c) => <tr key={c.id} className="border-t"><td className="p-2">{c.inicio && c.fim ? `${formatarDataCivil(c.inicio)} até ${formatarDataCivil(c.fim)}` : "Cobertura pendente de conferência"}</td><td className="p-2">{formatarDataCivil(c.vencimento)}</td><td className="p-2">{formatarMoeda(Number(c.valor), c.moeda)}</td></tr>)}</tbody>
        </table>
        {!m.mensalidadesExibidas.length && <EstadoVazio>Nenhuma mensalidade registrada.</EstadoVazio>}
      </div>}
      <p className="text-sm">Cobertura: {m.cobertura.referencia === "MES_CIVIL" ? "Mês civil" : m.cobertura.referencia === "CICLO_MATRICULA" ? "Ciclo mensal da matrícula" : "Referência pendente"} · {formatarDataCivil(m.cobertura.inicio, "Início pendente")} até {formatarDataCivil(m.cobertura.fim, "Fim pendente")}. Vencimento e cobertura são independentes.</p>
      {secretaria && m.assumida && !m.contratoConfirmado && ["RASCUNHO", "AGUARDANDO"].includes(m.status) && <form key={`${m.cobertura.cobrancaId}-${m.cobertura.versao}`} className="flex flex-wrap items-end gap-2 rounded border p-3" onSubmit={(e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        void executar(() => conferirCoberturaInicial({ matriculaId: m.id, cobrancaId: m.cobertura.cobrancaId ?? "", versaoEsperada: m.cobertura.versao ?? -1, primeiroVencimento: String(f.get("vencimento")), cobertura: { referencia: String(f.get("referencia")) as "MES_CIVIL" | "CICLO_MATRICULA", inicio: String(f.get("inicio")) }, motivo: String(f.get("motivo")) }));
      }}>
        <label className="grid gap-1 text-xs">Referência contratual<select name="referencia" required defaultValue={m.cobertura.referencia ?? ""} className={estilo}><option value="">Selecione</option><option value="MES_CIVIL">Mês civil</option><option value="CICLO_MATRICULA">Ciclo mensal da matrícula</option></select></label>
        <label className="grid gap-1 text-xs">Início do primeiro período<input name="inicio" type="date" required defaultValue={formatarDataCivil(m.cobertura.inicio, "")} className={estilo} /></label>
        <label className="grid gap-1 text-xs">Primeiro vencimento acordado<input name="vencimento" type="date" required defaultValue={m.cobertura.vencimento ?? ""} className={estilo} /></label>
        <label className="grid gap-1 text-xs">Motivo da conferência<input name="motivo" required minLength={5} maxLength={2000} className={estilo} /></label>
        <button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Conferir cobertura inicial</button>
      </form>}
      <p className="text-sm text-gray-500">{rotular(STATUS_MATRICULA_LABEL, m.status)} · {m.assumida ? "Cadastro sob responsabilidade da secretaria" : "Aguardando secretaria"} · {m.contratoConfirmado ? "Aceite contratual registrado" : "Aceite contratual pendente"}</p>
      {secretaria && !m.assumida && !["ENCERRADA", "CANCELADA"].includes(m.status) && <button disabled={ocupado} onClick={() => executar(() => assumirMatricula(m.id))} className={botaoClasses({ tamanho: "lg" })}>Assumir matrícula</button>}
      {secretaria && m.assumida && ["RASCUNHO", "AGUARDANDO"].includes(m.status) && <div className="space-y-1"><button disabled={ocupado} onClick={() => executar(() => concluirMatricula(m.id))} className={botaoClasses({ tamanho: "lg" })}>Concluir matrícula</button><p className="text-xs text-gray-500">Requer aceite contratual, disponibilidade e pagamentos exigidos nas condições da matrícula. A entrada pode exigir primeira mensalidade ou adiantamento das particulares.</p></div>}
      {secretaria && m.assumida && <div className="space-y-2 rounded bg-gray-50 p-3">
        <label className="grid max-w-xs gap-1 text-xs">Categoria do novo documento<select value={categorias[m.id] ?? CategoriaDocumento.CONTRATO} onChange={(e) => setCategorias((atual) => ({ ...atual, [m.id]: e.target.value as CategoriaDocumento }))} className={estilo}><option value="CONTRATO">Contrato</option><option value="PROPOSTA">Proposta</option><option value="COMPROVANTE">Comprovante</option></select></label>
        <UploadArquivo key={`${m.id}-${categorias[m.id] ?? CategoriaDocumento.CONTRATO}`} label="Anexar documento" matriculaId={m.id} categoriaDocumento={categorias[m.id] ?? CategoriaDocumento.CONTRATO} onUpload={(arquivo) => { void executar(() => anexarDocumentoMatricula(m.id, { ...arquivo, categoria: categorias[m.id] ?? CategoriaDocumento.CONTRATO })); }} />
        {m.documentos.length > 0 && <ul className="space-y-1 text-sm">{m.documentos.map((d) => <li key={d.id} className="flex items-center justify-between gap-2"><span><a href={d.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">{d.nome}</a> · {d.categoria}</span><button type="button" disabled={ocupado} onClick={() => executar(() => d.matriculaId ? arquivarDocumentoMatricula(d.id) : arquivarDocumentoLead(d.id))} className={botaoClasses({ variante: "fantasma", tamanho: "sm" })}>Arquivar</button></li>)}</ul>}
        {m.exigeAssinaturaIntegrada ? <p className="text-sm">Esta contratação exige assinatura integrada e conferência do original assinado. <Link className="underline" href={`/matriculas/${m.id}/contrato`}>Acompanhar documentos e assinaturas</Link></p> : <form key={JSON.stringify([m.mensalidadesExibidas, m.documentos, m.cobertura.referencia, m.contratoConfirmado])} onSubmit={(e) => confirmar(e, m.id)} className="flex flex-wrap items-center gap-2"><label className="grid gap-1 text-xs">Evidência contratual<select name="documentoId" required className={estilo}><option value="">Selecione o contrato</option>{m.documentos.filter((d) => d.categoria === "CONTRATO").map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></label><label className="text-sm"><input type="checkbox" required /> Conferi a evidência de aceite do contrato.</label><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar aceite</button></form>}
      </div>}
      {!secretaria && m.assumida && <form onSubmit={(e) => pedir(e, m.id)} className="grid gap-2 md:grid-cols-2"><label className="grid gap-1 text-xs">Campo<select name="campo" className={estilo}>{Object.entries(campos).map(([c, label]) => <option key={c} value={c}>{label}</option>)}</select></label><label className="grid gap-1 text-xs">Valor proposto / descrição<input name="valor" maxLength={500} className={estilo} /></label><label className="grid gap-1 text-xs md:col-span-2">Motivo<input name="motivo" required minLength={5} maxLength={2000} className={estilo} /></label><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Solicitar correção</button></form>}
      {m.correcoes.map((c) => <div key={c.id} className="space-y-2 rounded border p-3 text-sm"><p><strong>{campos[c.campo as Campo] ?? c.campo}</strong> · {c.status}</p><p>{c.valorProposto || "Remover valor"} · {c.motivo}</p>{c.motivoResolucao && <p>{c.motivoResolucao}</p>}{secretaria && c.status === "PENDENTE" && <form onSubmit={(e) => resolver(e, c.id)} className="flex flex-wrap gap-2"><label className="grid gap-1 text-xs">Decisão<select name="decisao" className={estilo}><option value="aprovar">Aplicar correção</option><option value="rejeitar">Rejeitar pedido</option></select></label><label className="grid gap-1 text-xs">Motivo da resolução<input name="motivo" minLength={5} required className={estilo} /></label>{c.campo === "documentos" && <label className="grid gap-1 text-xs">Documento corrigido<select name="documentoId" className={estilo}><option value="">Selecione</option>{m.documentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></label>}<button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Concluir decisão</button></form>}</div>)}
    </article>)}
  </div>;
}
