"use client";
import { useRef, useState } from "react";
import { consultarComprasHorasAntecipadas, registrarCompraHorasAntecipadas } from "@/server/matricula/compra-horas";
import { useOperacao } from "./useOperacao";
import { reservarHorasCompradasParaEncontro } from "@/server/matricula/reserva-horas-compradas";
import { conferirRealizacaoHoras } from "@/server/matricula/consumo-horas";
import { LiberacaoHoras } from "./LiberacaoHoras";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarComprasHorasAntecipadas>>, { ok: true }>["dado"]>;
const estilo = "rounded border p-2 text-sm";

export function RegistroCompraHoras({ nome, criadoEm, preferenciaFusoExibicao }: { nome: string; criadoEm: string; preferenciaFusoExibicao?: string | null }) {
  const exibicao = formatarInstanteExibicao(criadoEm, preferenciaFusoExibicao, "UTC");
  return <p>Registrado por {nome} em {exibicao.texto} (horário exibido em {exibicao.fuso}; origem UTC).</p>;
}

function Compras({ alunoId, matriculaId, preferenciaFusoExibicao }: { alunoId: string; matriculaId: string; preferenciaFusoExibicao?: string | null }) {
  const [dados, setDados] = useState<Dados | null>(null), [erro, setErro] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useOperacao();
  const chave = useRef("");
  async function carregar() {
    const r = await consultarComprasHorasAntecipadas({ alunoId, matriculaId });
    if (!r.ok || !r.dado) throw new Error(r.ok ? "Consulta indisponível." : r.erro);
    setDados(r.dado);
  }
  return <div className="space-y-3">
    <button type="button" disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => { void iniciar(async () => { setErro(null); try { await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha na consulta."); } }); }}>Consultar compras de horas</button>
    {erro && <p role="alert">{erro}</p>}<MensagemStatus texto={aviso} />
    {dados && <>
      {dados.compras.length === 0 && <p>Nenhuma compra de horas registrada nesta matrícula.</p>}
      {dados.compras.map((c) => <details key={c.id} className="rounded border p-2"><summary>{c.minutosComprados} minutos comprados · {formatarMoeda(c.valorPagoAlocado, c.moeda)}</summary>
        <RegistroCompraHoras nome={c.registrador.nome} criadoEm={c.criadoEm} preferenciaFusoExibicao={preferenciaFusoExibicao} />
        <p>{c.liquidacao ? `Quitação: ${formatarMoeda(c.liquidacao.valorEmDinheiro, c.moeda)} em dinheiro e ${formatarMoeda(c.liquidacao.valorEmCredito, c.moeda)} em crédito.` : "Compra anterior: consulte os registros de origem para conferir a quitação."}</p><p>Valor original: {formatarMoeda(c.valorOriginal, c.moeda)}. Desconto original: {formatarMoeda(c.descontoOriginal, c.moeda)}. Cobrança: {c.cobrancaId}.</p><p>{c.evidenciaCondicoes}</p>
        <p>{c.minutosReservados} minutos reservados · {c.minutosConsumidos} consumidos · {c.minutosConvertidosCredito} convertidos em crédito · {c.minutosDisponiveis} ainda não reservados.</p>
        {c.reservas.map(r => <div key={r.id}><p>{r.minutos} minutos · encontro {r.encontroId} · {r.convertidaCredito ? "convertida em crédito" : r.liberada ? "reserva liberada para remarcação" : r.consumo?.conferenciaOcorrencia ? `consumida por ${r.consumo.conferenciaOcorrencia.desfecho}` : r.consumo ? "consumo por aula realizada" : "reserva registrada"}</p>
          {!r.consumo && !r.liberada && r.statusEncontro !== "CANCELADO" && <ConsumoHoras reservaId={r.id} aoSalvar={carregar} />}
          {r.statusEncontro === "CANCELADO" && !r.consumo && <LiberacaoHoras alunoId={alunoId} reservaId={r.id} propostas={r.propostasLiberacao} aoSalvar={carregar} />}
        </div>)}
        {dados.encontros.length > 0 && <form className="space-y-2" onChange={() => { chave.current = ""; }} onSubmit={event => {
          event.preventDefault(); const form = event.currentTarget, valores = new FormData(form);
          void iniciar(async () => {
            setErro(null); setAviso(null); chave.current ||= crypto.randomUUID();
            try {
              const r = await reservarHorasCompradasParaEncontro({ compraId: c.id, encontroId: String(valores.get("encontro")), motivo: String(valores.get("motivo")), chaveIdempotencia: chave.current });
              if (!r.ok) { setErro(r.erro); return; }
              chave.current = ""; form.reset(); setAviso("Horas reservadas. Nenhum novo recebimento ou consumo registrado."); await carregar();
            } catch { setErro("Confira a consulta antes de repetir a reserva."); }
          });
        }}><fieldset disabled={ocupado} className="space-y-2"><legend>Vincular horas a encontro já agendado</legend>
          <label className="grid gap-1">Encontro<select name="encontro" required className={estilo} defaultValue=""><option value="">Selecione</option>{dados.encontros.map(e => <option key={e.id} value={e.id}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: e.fusoOrigem }).format(new Date(e.inicio))} · {e.fusoOrigem} · {(Date.parse(e.fim) - Date.parse(e.inicio)) / 60000} minutos</option>)}</select></label>
          <label className="grid gap-1">Motivo<textarea name="motivo" minLength={5} maxLength={2000} required className={estilo} /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Reservar horas</button>
        </fieldset></form>}
      </details>)}
      {!dados.cobrancas.length ? <p>Nenhuma cobrança de particular por hora paga e sem compra vinculada.</p> : <form className="space-y-2" onChange={() => { chave.current = ""; }} onSubmit={(e) => {
        e.preventDefault(); const form = e.currentTarget, f = new FormData(form);
        const c = dados.cobrancas.find((c) => c.id === f.get("cobranca"));
        if (!c) { setErro("Escolha a cobrança desta matrícula."); return; }
        void iniciar(async () => {
          setErro(null); setAviso(null); chave.current ||= crypto.randomUUID();
          try {
            const r = await registrarCompraHorasAntecipadas({ alunoId, matriculaId, cobrancaId: c.id, versaoCobranca: c.versao, minutosComprados: Number(f.get("minutos")), evidenciaCondicoes: String(f.get("evidencia") ?? ""), chaveIdempotencia: chave.current });
            if (!r.ok) { setErro(r.erro); return; }
            setAviso("Compra registrada. Nenhum novo recebimento foi criado."); form.reset(); chave.current = "";
            try { await carregar(); } catch { setErro("Compra salva, mas a consulta falhou. Consulte novamente antes de continuar."); }
          } catch { setErro("Resultado incerto. Repita sem alterar os dados ou consulte as compras."); }
        });
      }}><fieldset disabled={ocupado} className="space-y-2">
        <legend className="font-medium">Identificar compra já paga</legend>
        <p>O registro confere contrato, recebimentos e utilizações de crédito aprovadas. Informe a quantidade total de minutos prevista na compra.</p>
        <label className="grid gap-1">Cobrança das horas<select name="cobranca" required className={estilo} defaultValue=""><option value="">Selecione</option>{dados.cobrancas.map((c) => <option key={c.id} value={c.id}>{formatarDataCivil(c.vencimento)} · {formatarMoeda(c.valorNegociado, c.moeda)} · {c.id}</option>)}</select></label>
        <label className="grid gap-1">Minutos comprados<input name="minutos" type="number" required min={1} max={5256000} step={1} className={estilo} /></label>
        <label className="grid gap-1">Evidência das condições da compra<textarea name="evidencia" required minLength={5} maxLength={2000} className={estilo} /></label>
        <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Registrar compra de horas</button>
      </fieldset></form>}
    </>}
  </div>;
}

export function ComprasHorasPainel({ alunoId, contratos, preferenciaFusoExibicao = null }: { alunoId: string; contratos: { id: string; codigo: string | null }[]; preferenciaFusoExibicao?: string | null }) {
  const [matriculaId, setMatriculaId] = useState(contratos[0]?.id ?? "");
  return <section className="space-y-3 rounded border p-3" aria-label="Compras de horas antecipadas"><h2 className="text-lg font-medium">Compras de horas antecipadas</h2>
    <label className="grid gap-1">Contrato das horas<select className={estilo} value={matriculaId} onChange={(e) => setMatriculaId(e.target.value)}>{contratos.map((c) => <option key={c.id} value={c.id}>{c.codigo ?? c.id}</option>)}</select></label>
    {matriculaId && <Compras key={matriculaId} alunoId={alunoId} matriculaId={matriculaId} preferenciaFusoExibicao={preferenciaFusoExibicao} />}
  </section>;
}

function ConsumoHoras({ reservaId, aoSalvar }: { reservaId: string; aoSalvar: () => Promise<void> }) {
  const [revisao, setRevisao] = useState<{ estadoDiario: string; minutos: number } | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useOperacao();
  return <div className="space-y-2">
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={ocupado} onClick={() => { void iniciar(async () => {
      setErro(""); setRevisao(null);
      try { const r = await conferirRealizacaoHoras({ reservaId }); if (!r.ok || !r.dado) { setErro(r.ok ? "Consulta indisponível" : r.erro); return; } if (r.dado.consumoId) { await aoSalvar(); return; } if (!r.dado.estadoDiario) { setErro("A realização ainda não tem estado de diário conferível."); return; } setRevisao({ estadoDiario: r.dado.estadoDiario, minutos: r.dado.minutos }); }
      catch { setErro("Não foi possível conferir a realização."); }
    }); }}>Conferir realização</button>
    {revisao && <form onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); void iniciar(async () => {
      setErro("");
      try { const r = await conferirRealizacaoHoras({ reservaId, estadoDiario: revisao.estadoDiario, motivo: String(f.get("motivo")) }); if (!r.ok) { setErro(r.erro); return; } setRevisao(null); await aoSalvar(); }
      catch { setErro("Consulte o resultado antes de repetir."); }
    }); }}><fieldset disabled={ocupado} className="space-y-2"><p>Diário com conteúdo e presença registrados: consumir {revisao.minutos} minutos da compra. A pendência de gravação permanece separada.</p><label className="grid gap-1">Motivo da conferência<textarea name="motivo" required minLength={5} maxLength={2000} className={estilo} /></label><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Confirmar consumo pela realização</button></fieldset></form>}
    {erro && <p role="alert">{erro}</p>}
  </div>;
}
