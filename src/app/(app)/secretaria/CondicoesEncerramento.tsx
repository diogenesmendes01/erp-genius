"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepararCondicoesEncerramento, decidirCondicoesEncerramento } from "@/server/matricula/condicoes-encerramento";
import { RegrasEncerramentoSchema } from "@/server/matricula/condicoes-encerramento-schema";

type FonteOriginalEnviado = { processoAssinaturaId: string; artefatoContratualId: string };
type Versao = { id: string; versao: number; status: string; regras: unknown; motivo: string; motivoDecisao: string | null; preparadorId: string; documento: { nome: string; url: string } | null; artefatoContratual: { id: string } | null; processoAssinatura: { id: string; estado: string; envioConfirmado: boolean; conclusaoRegistrada: boolean } | null; preparador: { nome: string }; decisor: { nome: string } | null };
const campo = "rounded border p-2 text-sm";

export function CondicoesEncerramento({ matriculaId, codigo, documentoId, autorId, administrador, versoes, fontesOriginaisEnviados }: {
  matriculaId: string; codigo: string; documentoId: string | null; autorId: string; administrador: boolean; versoes: Versao[]; fontesOriginaisEnviados: FonteOriginalEnviado[];
}) {
  const router = useRouter();
  const trava = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tipoMulta, setTipoMulta] = useState("");
  const [tipoAcerto, setTipoAcerto] = useState("");
  async function executar(acao: () => Promise<{ ok: boolean; erro?: string }>) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro(null);
    try { const r = await acao(); if (!r.ok) setErro(r.erro ?? "Operação não concluída."); else router.refresh(); }
    catch { setErro("Não foi possível confirmar o resultado. Atualize a página antes de tentar novamente."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <section className="space-y-3 rounded border p-4">
    <h2 className="font-medium">{codigo} · Condições de encerramento</h2>
    <p className="text-sm">Transcreva as condições do contrato confirmado ou do original enviado. A aprovação por outra pessoa da Administração confere estas regras; o acerto financeiro e o encerramento exigem seus próprios procedimentos.</p>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
    {versoes.map((v) => {
      const resultado = RegrasEncerramentoSchema.safeParse(v.regras);
      const r = resultado.success ? resultado.data : null;
      return <article key={v.id} className="space-y-2 rounded bg-gray-50 p-3 text-sm">
        <h3>Versão {v.versao} · {v.status === "PENDENTE" ? "Aguardando aprovação" : v.status === "APROVADA" ? "Aprovada" : "Rejeitada"}</h3>
        <p>Preparada por {v.preparador.nome}. Motivo: {v.motivo}</p>
        {v.documento ? <a href={v.documento.url} target="_blank" rel="noopener noreferrer" className="underline">Contrato confirmado: {v.documento.nome}</a> : v.artefatoContratual && v.processoAssinatura ? <p>{v.processoAssinatura.estado === "ENVIADO" && v.processoAssinatura.envioConfirmado && !v.processoAssinatura.conclusaoRegistrada ? "Original conferido com envio externo confirmado; fonte vigente para a conferência." : v.processoAssinatura.estado === "CANCELADO" ? "Original enviado foi cancelado; esta versão permanece como histórico e requer nova conferência." : "Original enviado sem vigência para nova aprovação."}</p> : <p role="alert">Fonte contratual indisponível.</p>}
        {r ? <div className="space-y-1">
          <p>Dia do encerramento: {r.diaEncerramento === "INCLUIR" ? "incluído" : "excluído"} da cobertura.</p>
          <p>Desconto: {r.metodoDesconto === "ANTES_DO_PROPORCIONAL" ? "antes" : "depois"} do proporcional. Condições: {r.condicoesDescontos}</p>
          {r.multa.tipo === "SEM_PREVISAO" ? <p>Sem previsão de multa: {r.multa.motivo}</p> : <><p>Multa: {r.multa.tipo === "VALOR_FIXO" ? `${r.multa.valor} na moeda contratada` : `${r.multa.percentual}% sobre ${r.multa.descricaoBase}`}</p><p>Cláusula: {r.multa.clausulaId}. Aplicação: {r.multa.condicoesAplicacao}</p></>}
        </div> : <p role="alert">Regras incompletas; esta versão não pode ser aprovada.</p>}
        {v.decisor && <p>Decisão por {v.decisor.nome}: {v.motivoDecisao}</p>}
        {v.status === "PENDENTE" && (administrador && v.preparadorId !== autorId ? <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          void executar(() => decidirCondicoesEncerramento({ id: v.id, aprovar: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")) }));
        }}>
          <label className="grid gap-1">Decisão<select name="decisao" required defaultValue="" className={campo}><option value="">Selecione</option><option value="aprovar" disabled={!r || (!!v.processoAssinatura && (v.processoAssinatura.estado !== "ENVIADO" || !v.processoAssinatura.envioConfirmado || v.processoAssinatura.conclusaoRegistrada))}>Aprovar regras conferidas</option><option value="rejeitar">Rejeitar proposta</option></select></label>
          <label className="grid gap-1">Motivo da decisão<input name="motivo" minLength={5} maxLength={2000} required className={campo} /></label>
          <button disabled={ocupado} className={campo}>Registrar decisão</button>
        </form> : <p>Aguardando decisão de outra pessoa da Administração.</p>)}
      </article>;
    })}
    {!documentoId && !fontesOriginaisEnviados.length ? <p className="text-sm">Confirme o contrato ou aguarde o envio externo confirmado de um original para preparar estas condições.</p> : !versoes.some((v) => v.status === "PENDENTE") && <details>
      <summary className="cursor-pointer">Preparar nova versão das condições</summary>
      <form key={`${documentoId ?? "original"}-${versoes.length}`} className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={(e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); const s = (nome: string) => String(f.get(nome) ?? "");
        const multa = tipoMulta === "SEM_PREVISAO" ? { tipo: tipoMulta, motivo: s("semMulta") } : { tipo: tipoMulta, clausulaId: s("clausula"), condicoesAplicacao: s("aplicacao"), ...(tipoMulta === "VALOR_FIXO" ? { valor: s("valor") } : { percentual: s("valor"), descricaoBase: s("base") }) };
        const acertoDesistenciaPreparacao = !tipoAcerto ? undefined : tipoAcerto === "VALOR_FIXO"
          ? { tipo: tipoAcerto, valor: s("valorAcerto"), clausulaId: s("clausulaAcerto"), condicoesAplicacao: { momento: "ANTES_ATIVACAO", unidade: "POR_COBRANCA", alcance: { tipo: "TODAS_COBRANCAS_MATRICULA" } } }
          : { tipo: tipoAcerto, percentual: s("valorAcerto"), clausulaId: s("clausulaAcerto"), condicoesAplicacao: { momento: "ANTES_ATIVACAO", unidade: "POR_COBRANCA", alcance: { tipo: "TODAS_COBRANCAS_MATRICULA" } } };
        const regras = RegrasEncerramentoSchema.safeParse({ diaEncerramento: s("dia"), metodoDesconto: s("desconto"), condicoesDescontos: s("condicoes"), multa, acertoDesistenciaPreparacao });
        if (!regras.success) { setErro("Complete as regras do contrato. Valores devem usar ponto decimal e até duas casas."); return; }
        const fonte = fontesOriginaisEnviados.find((item) => item.processoAssinaturaId === s("processoAssinaturaId"));
        if (!documentoId && !fonte) { setErro("Escolha o original enviado com confirmação externa."); return; }
        void executar(() => prepararCondicoesEncerramento({ matriculaId, ...(documentoId ? { documentoId } : { artefatoContratualId: fonte!.artefatoContratualId, processoAssinaturaId: fonte!.processoAssinaturaId }), regras: regras.data, motivo: s("motivo") }));
      }}>
        {documentoId ? <p className="text-sm md:col-span-2">Fonte: contrato confirmado da matrícula.</p> : <label className="grid gap-1 text-sm md:col-span-2">Original enviado com confirmação externa<select name="processoAssinaturaId" required defaultValue="" className={campo}><option value="">Selecione o original conferido</option>{fontesOriginaisEnviados.map((fonte, indice) => <option key={fonte.processoAssinaturaId} value={fonte.processoAssinaturaId}>Original enviado {indice + 1}</option>)}</select></label>}
        <label className="grid gap-1 text-sm">Dia efetivo do encerramento<select name="dia" required defaultValue="" className={campo}><option value="">Selecione conforme contrato</option><option value="INCLUIR">Incluir na cobertura</option><option value="EXCLUIR">Excluir da cobertura</option></select></label>
        <label className="grid gap-1 text-sm">Aplicação do desconto<select name="desconto" required defaultValue="" className={campo}><option value="">Selecione conforme contrato</option><option value="ANTES_DO_PROPORCIONAL">Antes do proporcional</option><option value="DEPOIS_DO_PROPORCIONAL">Depois do proporcional</option></select></label>
        <label className="grid gap-1 text-sm">Condições dos descontos<textarea name="condicoes" required className={campo} /></label>
        <label className="grid gap-1 text-sm">Previsão de multa<select value={tipoMulta} onChange={(e) => setTipoMulta(e.target.value)} required className={campo}><option value="">Selecione conforme contrato</option><option value="SEM_PREVISAO">Sem previsão</option><option value="VALOR_FIXO">Valor fixo</option><option value="PERCENTUAL">Percentual</option></select></label>
        {tipoMulta === "SEM_PREVISAO" && <label className="grid gap-1 text-sm">Fundamento da ausência de multa<textarea name="semMulta" required className={campo} /></label>}
        {["VALOR_FIXO", "PERCENTUAL"].includes(tipoMulta) && <>
          <label className="grid gap-1 text-sm">Cláusula contratual<input name="clausula" required className={campo} /></label>
          <label className="grid gap-1 text-sm">Condições de aplicação<textarea name="aplicacao" required className={campo} /></label>
          <label className="grid gap-1 text-sm">{tipoMulta === "VALOR_FIXO" ? "Valor na moeda do contrato" : "Percentual"}<input name="valor" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required className={campo} /></label>
          {tipoMulta === "PERCENTUAL" && <label className="grid gap-1 text-sm">Base de cálculo prevista no contrato<textarea name="base" required className={campo} /></label>}
        </>}
        <label className="grid gap-1 text-sm">Regra de acerto por desistência antes da ativação<select value={tipoAcerto} onChange={(e) => setTipoAcerto(e.target.value)} required={!documentoId} className={campo}><option value="">{documentoId ? "Não informar nesta versão" : "Selecione a regra Q165"}</option><option value="VALOR_FIXO">Valor fixo</option><option value="PERCENTUAL_VALOR_NEGOCIADO">Percentual do valor negociado</option></select></label>
        {tipoAcerto && <><label className="grid gap-1 text-sm">Cláusula do acerto<input name="clausulaAcerto" required className={campo} /></label><label className="grid gap-1 text-sm">{tipoAcerto === "VALOR_FIXO" ? "Valor do acerto" : "Percentual do acerto"}<input name="valorAcerto" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required className={campo} /></label><p className="text-sm md:col-span-2">A regra informada se aplica antes da ativação a todas as cobranças da matrícula.</p></>}
        <label className="grid gap-1 text-sm">Motivo e referência da conferência<textarea name="motivo" minLength={5} maxLength={2000} required className={campo} /></label>
        <button disabled={ocupado} className={`${campo} self-end`}>Enviar para aprovação administrativa</button>
      </form>
    </details>}
  </section>;
}
