"use client";

import { useState } from "react";
import { CategoriaDocumento } from "@prisma/client";
import { Botao } from "@/components/Botao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { UploadArquivo } from "@/components/UploadArquivo";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { STATUS_COBRANCA_LABEL } from "@/lib/labels";
import { registrarLinkPagamento } from "@/server/matricula/acoes";
import { anexarDocumentoPropostaNoInbox, enviarPropostaNoInbox } from "@/server/inbox/acoes-fechamento-painel";
import type { ContratacaoPainel, OportunidadeAtualPainel, StatusAlcadaPainel } from "@/server/inbox/painel-oportunidades";

export type SecaoFechamentoInbox = "enviarProposta" | "prepararContratacao";
type Props = {
  atendimentoId: string;
  oportunidade: OportunidadeAtualPainel;
  podeAgir: boolean;
  secao: SecaoFechamentoInbox | null;
  aoMudar(): void;
};

const ALCADA: Record<StatusAlcadaPainel, string> = {
  DENTRO_ALCADA: "Dentro da alçada",
  AGUARDANDO_APROVACAO: "Aguardando aprovação comercial",
  APROVADA: "Exceção aprovada",
  REJEITADA: "Exceção rejeitada",
};
const contratacaoVazia: ContratacaoPainel = { matriculaId: null, statusAlcada: null, motivoDecisao: null, taxaMatricula: null };

export function AcoesFechamentoOportunidade({ atendimentoId, oportunidade: o, podeAgir, secao, aoMudar }: Props) {
  const acao = useAcaoCliente({ idempotente: false });
  const acaoLink = useAcaoCliente({ idempotente: true });
  const tentativaLink = useChaveIdempotencia();
  const contratacao = o.contratacao ?? contratacaoVazia;
  const documentos = o.documentosProposta ?? [];
  const mostrarProposta = secao === "enviarProposta" || o.etapa === "PROPOSTA" || documentos.length > 0;
  const mostrarContratacao = podeAgir && (secao === "prepararContratacao" || !!contratacao.matriculaId || o.etapa === "AGUARDANDO_MATRICULA" || o.etapa === "MATRICULADO");
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);
  const taxa = contratacao.taxaMatricula;

  if (!mostrarProposta && !mostrarContratacao) return null;

  async function enviarProposta() {
    if (!podeAgir || acao.ocupado) return;
    const r = await acao.executar(() => enviarPropostaNoInbox(atendimentoId, o.id), "Proposta enviada.");
    if (r?.tipo === "ok") aoMudar();
  }

  async function anexar(doc: { nome: string; url: string }) {
    const r = await acao.executar(() => anexarDocumentoPropostaNoInbox(atendimentoId, o.id, doc), "Proposta anexada.");
    if (r?.tipo === "ok") aoMudar();
  }

  async function registrarLink() {
    if (!taxa) return;
    const d = await acaoLink.executar(() => registrarLinkPagamento(taxa.cobrancaId, link, { chaveIdempotencia: tentativaLink.atual }), "Link de pagamento registrado.");
    tentativaLink.depoisDo(d);
    if (d?.tipo === "ok") { setLink(""); aoMudar(); }
  }

  async function copiarLink() {
    if (!taxa?.linkPagamento) return;
    try {
      await navigator.clipboard.writeText(taxa.linkPagamento);
      setCopiado(true);
    } catch {
      setCopiado(false);
      acao.setErro("Não foi possível copiar o link.");
    }
  }

  return <div className="space-y-3">
    {mostrarProposta && <section aria-label="Proposta" className="space-y-2 rounded-[10px] border border-gray-200 bg-surface-muted p-3">
      <h4 className="text-[13px] font-semibold">Proposta</h4>
      {podeAgir && o.etapa !== "PROPOSTA" && o.etapa !== "MATRICULADO" && o.etapa !== "PERDIDO" && <Botao variante="primario" tamanho="sm" disabled={acao.ocupado} onClick={() => void enviarProposta()}>Confirmar envio de proposta</Botao>}
      {o.etapa === "PROPOSTA" && <p className="text-sm text-gray-700">Proposta enviada.</p>}
      {documentos.length > 0 && <ul className="space-y-1 text-sm">{documentos.map((d) => <li key={d.id}><a className="text-brand-700 underline [overflow-wrap:anywhere]" href={d.url}>{d.nome}</a></li>)}</ul>}
      {podeAgir && <UploadArquivo label="Anexar proposta" leadId={o.id} categoriaDocumento={CategoriaDocumento.PROPOSTA} onUpload={(doc) => void anexar(doc)} />}
    </section>}

    {mostrarContratacao && <section aria-label="Contratação" className="space-y-2 rounded-[10px] border border-gray-200 bg-surface-muted p-3">
      <h4 className="text-[13px] font-semibold">Contratação</h4>
      {contratacao.matriculaId
        ? <a className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700 underline" href={`/matriculas/${contratacao.matriculaId}/preparacao`}>Ver preparação / alçada</a>
        : <a className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700 underline" href={`/oportunidades/${o.id}/contratacao`}>Preparar contratação</a>}
      {contratacao.statusAlcada && <p className="text-sm"><span className="inline-flex min-h-[22px] items-center rounded-full bg-brand-bg px-2 text-xs font-semibold text-brand-700">{ALCADA[contratacao.statusAlcada]}</span>{contratacao.statusAlcada === "REJEITADA" && contratacao.motivoDecisao ? <span className="mt-1 block text-gray-700">{contratacao.motivoDecisao}</span> : null}</p>}
      {taxa && <div className="space-y-2">
        <p className="text-sm">Taxa de matrícula: {STATUS_COBRANCA_LABEL[taxa.status]}</p>
        {podeAgir && (taxa.status === "PENDENTE" || taxa.status === "ATRASADO") && <div className="space-y-2">
          <input aria-label="Link de pagamento da taxa" className="w-full rounded-md border border-border-soft bg-surface p-2 text-sm" value={link} disabled={acaoLink.ocupado} onChange={(e) => setLink(e.target.value)} />
          <Botao variante="secundario" tamanho="sm" disabled={!link.trim() || acaoLink.ocupado} onClick={() => void registrarLink()}>Registrar link de pagamento</Botao>
          <FeedbackAcao erro={acaoLink.erro} sucesso={acaoLink.sucesso} />
        </div>}
        {taxa.linkPagamento && <div className="space-y-1">
          <p className="break-all text-xs text-gray-600">{taxa.linkPagamento}</p>
          <Botao variante="fantasma" tamanho="sm" onClick={() => void copiarLink()}>Copiar link</Botao>
          <MensagemStatus texto={copiado ? "Link copiado!" : null} className="text-xs text-gray-600" />
        </div>}
      </div>}
    </section>}
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </div>;
}
