"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CategoriaDocumento } from "@prisma/client";
import { UploadArquivo } from "@/components/UploadArquivo";
import { Avatar } from "@/components/Avatar";
import { BadgeEstado } from "@/components/BadgeEstado";
import { arquivarDocumentoLead } from "@/server/comercial/acoes";
import { assumirMatricula, resolverCorrecaoCadastro, confirmarContratoMatricula, anexarDocumentoMatricula, arquivarDocumentoMatricula } from "@/server/secretaria/acoes";
import { concluirMatricula } from "@/server/matricula/acoes";
import { conferirCoberturaInicial } from "@/server/secretaria/cobertura";
import { formatarMoeda } from "@/lib/dinheiro";
import { STATUS_MATRICULA_LABEL, rotular, CATEGORIA_DOCUMENTO_LABEL, STATUS_CORRECAO_CADASTRO_LABEL, REFERENCIA_COBERTURA_MENSAL_LABEL } from "@/lib/labels";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SeletorCampo, CaixaCampo } from "./controles";

type Matricula = {
  exigeAssinaturaIntegrada: boolean;
  mensalidadesExibidas: { id: string; versao: number; valor: string; moeda: string; inicio: string | null; fim: string | null; vencimento: string }[];
  cobertura: { cobrancaId: string | null; versao: number | null; vencimento: string | null; referencia: string | null; inicio: string | null; fim: string | null };
  id: string;
  codigo: string | null;
  leadId: string | null;
  alunoId: string | null;
  nome: string;
  status: string;
  assumida: boolean;
  contratoConfirmado: boolean;
  documentos: { id: string; nome: string; categoria: string; matriculaId: string | null; url: string }[];
  correcoes: { id: string; campo: string; valorProposto: string | null; motivo: string; status: string; motivoResolucao: string | null }[];
};
const campos = { primeiroNome: "Primeiro nome", sobrenome: "Sobrenome", nomePreferido: "Nome preferido", email: "E-mail", telefoneE164: "Telefone com DDI", documentos: "Documento (descreva a correção)" };
type Campo = keyof typeof campos;
const CHIP = "rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-highlight";

export function SecretariaPainel({ secretaria, matriculas }: { secretaria: boolean; matriculas: Matricula[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [categorias, setCategorias] = useState<Record<string, CategoriaDocumento>>({});
  const [aceites, setAceites] = useState<Record<string, boolean>>({});
  async function executar(operacao: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await operacao();
      if (!r.ok) setErro(r.erro ?? "Operação não concluída.");
      else router.refresh();
    } catch {
      setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    } finally {
      setOcupado(false);
    }
  }
  function resolver(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void executar(() => resolverCorrecaoCadastro(id, { aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")), documentoId: String(f.get("documentoId") ?? "") || undefined }));
  }
  function confirmar(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void executar(() => confirmarContratoMatricula(id, String(f.get("documentoId")), matriculas.find((m) => m.id === id)!.mensalidadesExibidas.map(({ id: cobrancaId, versao }) => ({ id: cobrancaId, versao }))));
  }
  return (
    <div className="space-y-4">
      {erro && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {!matriculas.length && <EstadoVazio>Nenhuma matrícula no seu escopo.</EstadoVazio>}
      {matriculas.map((m) => {
        const correcaoPendente = m.correcoes.some((c) => c.status === "PENDENTE");
        const rotuloNav = `Ações da matrícula ${m.codigo ?? ""}`.trim();
        return (
          <article key={m.id} className="space-y-3 rounded-lg border border-gray-200 bg-surface p-4">
            <div className="flex items-start gap-3">
              <Avatar nome={m.nome} tamanho={32} />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium text-gray-900">
                    <span className="font-mono tabular-nums">{m.codigo ?? "Matrícula"}</span>
                    {" · "}{m.nome}
                  </h2>
                  {m.alunoId && <Link className="text-sm text-brand-700" href={`/alunos/${m.alunoId}`}>Abrir cadastro do aluno</Link>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <BadgeEstado tom="neutro">{rotular(STATUS_MATRICULA_LABEL, m.status)}</BadgeEstado>
                  <BadgeEstado tom={m.assumida ? "sucesso" : "aviso"}>{m.assumida ? "Cadastro sob responsabilidade da secretaria" : "Aguardando secretaria"}</BadgeEstado>
                  {correcaoPendente
                    ? <BadgeEstado tom="perigo">Correção solicitada</BadgeEstado>
                    : <BadgeEstado tom={m.contratoConfirmado ? "sucesso" : "aviso"}>{m.contratoConfirmado ? "Aceite contratual registrado" : "Aceite contratual pendente"}</BadgeEstado>}
                </div>
              </div>
            </div>
            <nav aria-label={rotuloNav} className="flex flex-wrap gap-2">
              <Link className={CHIP} href={`/matriculas/${m.id}/preparacao`}>Revisar proposta comercial</Link>
              {secretaria && <>
                <Link className={CHIP} href={`/matriculas/${m.id}/pagador`}>Conferir pagador desta matrícula</Link>
                <Link className={CHIP} href={`/matriculas/${m.id}/condicoes`}>Conferir condições de entrada</Link>
                <Link className={CHIP} href={`/matriculas/${m.id}/emissao`}>Conferir e emitir cobranças iniciais</Link>
                <Link className={CHIP} href={`/matriculas/${m.id}/contrato`}>Preparar e consultar prévias contratuais</Link>
                <Link className={CHIP} href={`/matriculas/${m.id}/autorizacoes-comunicacao`}>Gerir destinatários acadêmicos</Link>
              </>}
              <Link className={CHIP} href={`/matriculas/${m.id}/reserva`}>Consultar ou reservar vaga</Link>
            </nav>
            <p className="text-sm">Cobertura: {m.cobertura.referencia ? rotular(REFERENCIA_COBERTURA_MENSAL_LABEL, m.cobertura.referencia) : "Referência pendente"} · {formatarDataCivil(m.cobertura.inicio, "Início pendente")} até {formatarDataCivil(m.cobertura.fim, "Fim pendente")}. Vencimento e cobertura são independentes.</p>
            {secretaria && !m.assumida && !["ENCERRADA", "CANCELADA"].includes(m.status) && <button disabled={ocupado} onClick={() => executar(() => assumirMatricula(m.id))} className={botaoClasses({ tamanho: "lg" })}>Assumir matrícula</button>}
            {secretaria && m.assumida && ["RASCUNHO", "AGUARDANDO"].includes(m.status) && (
              <div className="space-y-1">
                <button disabled={ocupado} onClick={() => executar(() => concluirMatricula(m.id))} className={botaoClasses({ tamanho: "lg" })}>Concluir matrícula</button>
                <p className="text-xs text-gray-500">Requer aceite contratual, disponibilidade e pagamentos exigidos nas condições da matrícula. A entrada pode exigir primeira mensalidade ou adiantamento das particulares.</p>
              </div>
            )}
            {secretaria && (
              <details className="group rounded-md border border-gray-200 bg-surface-muted">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-800">Conferir cobertura inicial e mensalidades</summary>
                <div className="space-y-3 px-3 pb-3">
                  <Table>
                    <TableCaption className="pb-2 text-left font-medium text-gray-800">Mensalidades para conferência contratual</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período coberto</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor contratado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.mensalidadesExibidas.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.inicio && c.fim ? `${formatarDataCivil(c.inicio)} até ${formatarDataCivil(c.fim)}` : "Cobertura pendente de conferência"}</TableCell>
                          <TableCell>{formatarDataCivil(c.vencimento)}</TableCell>
                          <TableCell>{formatarMoeda(Number(c.valor), c.moeda)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {!m.mensalidadesExibidas.length && <EstadoVazio>Nenhuma mensalidade registrada.</EstadoVazio>}
                  {m.assumida && !m.contratoConfirmado && ["RASCUNHO", "AGUARDANDO"].includes(m.status) && (
                    <form key={`${m.cobertura.cobrancaId}-${m.cobertura.versao}`} className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void executar(() => conferirCoberturaInicial({ matriculaId: m.id, cobrancaId: m.cobertura.cobrancaId ?? "", versaoEsperada: m.cobertura.versao ?? -1, primeiroVencimento: String(f.get("vencimento")), cobertura: { referencia: String(f.get("referencia")) as "MES_CIVIL" | "CICLO_MATRICULA", inicio: String(f.get("inicio")) }, motivo: String(f.get("motivo")) }));
                    }}>
                      <label className="grid gap-1 text-xs">Referência contratual
                        <SeletorCampo name="referencia" required defaultValue={m.cobertura.referencia ?? ""}>
                          <option value="">Selecione</option>
                          <option value="MES_CIVIL">Mês civil</option>
                          <option value="CICLO_MATRICULA">Ciclo mensal da matrícula</option>
                        </SeletorCampo>
                      </label>
                      <label className="grid gap-1 text-xs">Início do primeiro período<DatePicker name="inicio" required defaultValue={m.cobertura.inicio ?? ""} /></label>
                      <label className="grid gap-1 text-xs">Primeiro vencimento acordado<DatePicker name="vencimento" required defaultValue={m.cobertura.vencimento ?? ""} /></label>
                      <label className="grid gap-1 text-xs">Motivo da conferência<Input name="motivo" required minLength={5} maxLength={2000} /></label>
                      <button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Conferir cobertura inicial</button>
                    </form>
                  )}
                </div>
              </details>
            )}
            {secretaria && m.assumida && (
              <details className="group rounded-md border border-gray-200 bg-surface-muted">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-800">Documentos e aceite contratual</summary>
                <div className="space-y-2 px-3 pb-3">
                  <label className="grid max-w-xs gap-1 text-xs">Categoria do novo documento
                    <SeletorCampo value={categorias[m.id] ?? CategoriaDocumento.CONTRATO} onChange={(e) => setCategorias((atual) => ({ ...atual, [m.id]: e.target.value as CategoriaDocumento }))}>
                      <option value="CONTRATO">Contrato</option>
                      <option value="PROPOSTA">Proposta</option>
                      <option value="COMPROVANTE">Comprovante</option>
                    </SeletorCampo>
                  </label>
                  <UploadArquivo key={`${m.id}-${categorias[m.id] ?? CategoriaDocumento.CONTRATO}`} label="Anexar documento" matriculaId={m.id} categoriaDocumento={categorias[m.id] ?? CategoriaDocumento.CONTRATO} onUpload={(arquivo) => { void executar(() => anexarDocumentoMatricula(m.id, { ...arquivo, categoria: categorias[m.id] ?? CategoriaDocumento.CONTRATO })); }} />
                  {m.documentos.length > 0 && (
                    <ul className="space-y-1 text-sm">
                      {m.documentos.map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-2">
                          <span><a href={d.url} target="_blank" rel="noopener noreferrer" className="text-brand-700">{d.nome}</a> · {rotular(CATEGORIA_DOCUMENTO_LABEL, d.categoria)}</span>
                          <button type="button" disabled={ocupado} onClick={() => executar(() => d.matriculaId ? arquivarDocumentoMatricula(d.id) : arquivarDocumentoLead(d.id))} className={botaoClasses({ variante: "fantasma", tamanho: "sm" })}>Arquivar</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.exigeAssinaturaIntegrada
                    ? <p className="text-sm">Esta contratação exige assinatura integrada e conferência do original assinado. <Link className="text-brand-700" href={`/matriculas/${m.id}/contrato`}>Acompanhar documentos e assinaturas</Link></p>
                    : (
                      <form key={JSON.stringify([m.mensalidadesExibidas, m.documentos, m.cobertura.referencia, m.contratoConfirmado])} onSubmit={(e) => confirmar(e, m.id)} className="flex flex-wrap items-center gap-2">
                        <label className="grid gap-1 text-xs">Evidência contratual
                          <SeletorCampo name="documentoId" required>
                            <option value="">Selecione o contrato</option>
                            {m.documentos.filter((d) => d.categoria === "CONTRATO").map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                          </SeletorCampo>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <CaixaCampo checked={!!aceites[m.id]} onChange={(e) => setAceites((atual) => ({ ...atual, [m.id]: e.target.checked }))} required />
                          Conferi a evidência de aceite do contrato.
                        </label>
                        <button disabled={ocupado || !aceites[m.id]} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar aceite</button>
                      </form>
                    )}
                </div>
              </details>
            )}
            {m.correcoes.map((c) => (
              <div key={c.id} className="space-y-2 rounded-md border border-gray-200 p-3 text-sm">
                <p><strong>{campos[c.campo as Campo] ?? c.campo}</strong> · {rotular(STATUS_CORRECAO_CADASTRO_LABEL, c.status)}</p>
                <p>{c.valorProposto || "Remover valor"} · {c.motivo}</p>
                {c.motivoResolucao && <p>{c.motivoResolucao}</p>}
                {secretaria && c.status === "PENDENTE" && (
                  <details className="group rounded-md bg-surface-muted">
                    <summary className="cursor-pointer px-2 py-1 text-sm font-medium text-gray-800">Resolver correção</summary>
                    <form onSubmit={(e) => resolver(e, c.id)} className="flex flex-wrap gap-2 px-2 pb-2">
                      <label className="grid gap-1 text-xs">Decisão
                        <SeletorCampo name="decisao" defaultValue="aprovar">
                          <option value="aprovar">Aplicar correção</option>
                          <option value="rejeitar">Rejeitar pedido</option>
                        </SeletorCampo>
                      </label>
                      <label className="grid gap-1 text-xs">Motivo da resolução<Input name="motivo" minLength={5} required /></label>
                      {c.campo === "documentos" && (
                        <label className="grid gap-1 text-xs">Documento corrigido
                          <SeletorCampo name="documentoId">
                            <option value="">Selecione</option>
                            {m.documentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                          </SeletorCampo>
                        </label>
                      )}
                      <button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Concluir decisão</button>
                    </form>
                  </details>
                )}
              </div>
            ))}
          </article>
        );
      })}
    </div>
  );
}
