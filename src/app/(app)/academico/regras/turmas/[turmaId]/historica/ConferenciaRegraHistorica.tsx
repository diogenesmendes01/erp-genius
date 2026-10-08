"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ResumoRegra, type ConteudoRegra } from "../../../[nivelId]/ResumoRegra";
import { decidirConferenciaRegraHistorica, proporConferenciaRegraHistorica, revisarConferenciaRegraHistorica } from "@/server/avaliacoes/conferencia-regra-historica";
import { ConteudoRegraAvaliacaoSchema } from "@/server/avaliacoes/regra-schema";
import type { Resultado } from "@/server/_shared/resultado";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";

type Destino = { id: string; versao: number };
type Revisao = {
  destinoId: string; estadoHash: string; versaoEsperada: number;
  destino: { versao: number; conteudo: ConteudoRegra };
  encontros: number; diarios: number; alocacoes: number;
};

// Erro e sucesso separados (docs/42 E3; docs/43 §6 item 2): cada fluxo (Propor, Revisar, Decidir) tem o
// próprio useAcaoCliente — falha de transporte vira resultado incerto em role="alert" e o ocupado é
// liberado em qualquer desfecho. A trava de duplo envio é a do executor (executar devolve null).

export function ProporConferenciaRegraHistorica({ turmaId, revisao }: { turmaId: string; revisao: Revisao }) {
  const r = useRouter(), chave = useRef<string | null>(null);
  // Chave de idempotência estável entre tentativas: na falha de transporte, reenviar sem alterar (MSG_RESULTADO_INCERTO).
  const acao = useAcaoCliente({ idempotente: true });
  return <form className="space-y-3" onChange={() => { chave.current = null; acao.limpar(); }} onSubmit={async e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const chaveIdempotencia = (chave.current ??= crypto.randomUUID());
    const d = await acao.executar(() => proporConferenciaRegraHistorica({
      turmaId, destinoId: revisao.destinoId, estadoHash: revisao.estadoHash, versaoEsperada: revisao.versaoEsperada,
      motivo: String(f.get("motivo") ?? ""), evidencia: String(f.get("evidencia") ?? ""), chaveIdempotencia,
    }), "Conferência registrada para decisão independente.");
    if (d?.tipo === "ok") r.refresh();
  }}>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      <label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block">Evidência<CampoTexto name="evidencia" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label><input type="checkbox" required /> Conferi o conteúdo e as contagens exibidos.</label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Propor conferência"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}

export function PrepararConferenciaRegraHistorica({ turmaId, destinos }: { turmaId: string; destinos: Destino[] }) {
  const [destinoId, setDestinoId] = useState(""), [revisao, setRevisao] = useState<Revisao | null>(null);
  // Só leitura (revisão da fotografia): repetir é seguro; a falha mantém o texto próprio desta tela.
  const acao = useAcaoCliente({ idempotente: true });
  return <section className="space-y-3">
    <h2 className="text-xl font-medium">Conferência inicial da regra histórica</h2>
    <p>Escolha explicitamente a versão publicada demonstrada pela evidência.</p>
    <form onSubmit={async e => {
      e.preventDefault();
      if (!destinoId) { acao.setErro("Selecione uma versão publicada."); return; }
      const d = await acao.executar(async (): Promise<Resultado<Revisao>> => {
        const x = await revisarConferenciaRegraHistorica({ turmaId, destinoId });
        if (!x.ok) return x;
        const conteudo = x.dado ? ConteudoRegraAvaliacaoSchema.safeParse(x.dado.destino.conteudo) : null;
        if (!x.dado || !conteudo?.success) return { ok: false, erro: "A revisão retornou conteúdo inválido." };
        return { ok: true, dado: {
          destinoId, estadoHash: x.dado.estadoHash, versaoEsperada: x.dado.versaoEsperada,
          destino: { ...x.dado.destino, conteudo: conteudo.data },
          encontros: x.dado.encontros, diarios: x.dado.diarios, alocacoes: x.dado.alocacoes,
        } };
      });
      if (d === null) return;
      if (d.tipo === "ok" && d.dado) { setRevisao(d.dado); return; }
      setRevisao(null);
      if (d.tipo === "incerto") acao.setErro("A revisão não foi confirmada.");
    }}>
      <fieldset disabled={acao.ocupado} className="flex gap-3">
        <label>Versão publicada<select value={destinoId} onChange={e => { setDestinoId(e.target.value); setRevisao(null); acao.limpar(); }} className="ml-2 rounded border p-2">
          <option value="">Selecione</option>
          {destinos.map(d => <option key={d.id} value={d.id}>Versão {d.versao}</option>)}
        </select></label>
        <button className={botaoClasses({ variante: "secundario" })}>{acao.ocupado ? "Revisando…" : "Revisar"}</button>
      </fieldset>
    </form>
    <FeedbackAcao erro={acao.erro} />
    {revisao && <section className="space-y-3 rounded border p-3">
      <h3 className="font-medium">Versão {revisao.destino.versao} conferida</h3>
      <p>{revisao.encontros} encontros, {revisao.diarios} diários e {revisao.alocacoes} alocações na fotografia.</p>
      <ResumoRegra conteudo={revisao.destino.conteudo} />
      <ProporConferenciaRegraHistorica key={`${revisao.destinoId}:${revisao.estadoHash}:${revisao.versaoEsperada}`} turmaId={turmaId} revisao={revisao} />
    </section>}
  </section>;
}

export function DecidirConferenciaRegraHistorica({ propostaId, estadoHash, podeAprovar }: { propostaId: string; estadoHash: string; podeAprovar: boolean }) {
  // Antes não havia catch (docs/43): a falha de transporte deixava a tela sem resposta. Sem chave de
  // idempotência; a decisão incerta usa o texto das demais decisões (reenviar a mesma decisão).
  const r = useRouter(), acao = useAcaoCliente({ idempotente: false });
  return <form onSubmit={async e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const d = await acao.executar(() => decidirConferenciaRegraHistorica({ propostaId, estadoHash, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo") ?? "") }), "Decisão registrada.");
    if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA);
    else if (d?.tipo === "ok") r.refresh();
  }}>
    <fieldset disabled={acao.ocupado}>
      <select name="decisao" aria-label="Decisão da conferência" required defaultValue="">
        <option value="">Selecione</option>
        {podeAprovar && <option value="aprovar">Aprovar</option>}
        <option value="rejeitar">Rejeitar</option>
      </select>
      <CampoTexto name="motivo" aria-label="Motivo da decisão" required minLength={5} />
      <button className={botaoClasses({ tamanho: "lg" })}>Registrar decisão</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
