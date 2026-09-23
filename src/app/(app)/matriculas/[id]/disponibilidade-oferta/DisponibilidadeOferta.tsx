"use client";
import { useState, useRef } from "react";
import { consultarDisponibilidadesOferta, proporDisponibilidadeOferta, decidirDisponibilidadeOferta } from "@/server/matricula/disponibilidade-oferta";
import { useInicioDoPeriodo } from "@/lib/periodo-form";

type Dados = NonNullable<Extract<Awaited<ReturnType<typeof consultarDisponibilidadesOferta>>, { ok: true }>["dado"]>;
const campo = "block w-full rounded border p-2";
export function DisponibilidadeOferta({ matriculaId, inicial }: { matriculaId: string; inicial: Dados }) {
  const [dados, setDados] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const periodo = useInicioDoPeriodo();
  const chave = useRef<string | null>(null);
  async function carregar(pagina = dados.pagina) {
    const r = await consultarDisponibilidadesOferta({ matriculaId, pagina });
    if (!r.ok || !r.dado) throw new Error(r.ok ? "Consulta indisponível." : r.erro);
    setDados(r.dado);
  }
  async function executar(acao: () => Promise<void>) {
    setOcupado(true); setErro(null);
    try { await acao(); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível confirmar o resultado. Confira o histórico antes de repetir."); }
    finally { setOcupado(false); }
  }
  return <div className="space-y-4">
    {erro && <p role="alert">{erro}</p>}
    {dados.podePropor && <form className="space-y-3 rounded border p-4" onChange={() => { chave.current = null; }} onSubmit={e => {
      e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
      void executar(async () => {
        chave.current ??= crypto.randomUUID();
        const r = await proporDisponibilidadeOferta({ matriculaId, inicio: String(f.get("inicio")), fim: String(f.get("fim")), motivo: String(f.get("motivo")), evidenciaTexto: String(f.get("evidencia")), chaveIdempotencia: chave.current });
        if (!r.ok) throw new Error(r.erro);
        chave.current = null; form.reset(); await carregar(1);
      });
    }}>
      <fieldset disabled={ocupado} className="space-y-3">
        <legend>Propor confirmação de oferta</legend>
        <label className="block">Início do período<input type="date" name="inicio" required {...periodo.propsInicio} className={campo} /></label>
        <label className="block">Fim do período<input type="date" name="fim" required min={periodo.min} className={campo} /></label>
        <label className="block">Justificativa<textarea name="motivo" required minLength={5} maxLength={2000} className={campo} /></label>
        <label className="block">Evidências da oferta<textarea name="evidencia" required minLength={5} maxLength={4000} className={campo} /></label>
        <button className="rounded border p-2" type="submit">Enviar para conferência</button>
      </fieldset>
    </form>}
    {dados.propostas.length === 0 && <p>Nenhuma proposta registrada.</p>}
    {dados.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
      <h2>Período {p.inicio} a {p.fim} · versão {p.versao}</h2>
      <p className="whitespace-pre-wrap">{p.motivo}</p><p className="whitespace-pre-wrap">Evidências: {p.evidenciaTexto}</p>
      <p>{p.decisao ? p.decisao.aprovada ? "Aprovada — sujeita à validade das fontes" : "Rejeitada" : "Aguardando decisão"}</p>
      {p.decisao && <p className="whitespace-pre-wrap">Decisão: {p.decisao.motivo}</p>}
      {p.podeDecidir && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void executar(async () => {
        const r = await decidirDisponibilidadeOferta({ propostaId: p.id, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo")), evidenciaTexto: String(f.get("evidencia")) });
        if (!r.ok) throw new Error(r.erro); await carregar();
      }); }}>
        <fieldset disabled={ocupado} className="space-y-2">
          <legend>Conferência independente</legend>
          <label>Decisão<select name="decisao" required className={campo}><option value="">Selecione</option><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label>
          <label>Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className={campo} /></label>
          <label>Evidências conferidas<textarea name="evidencia" required minLength={5} maxLength={4000} className={campo} /></label>
          <button className="rounded border p-2" type="submit">Registrar decisão</button>
        </fieldset>
      </form>}
    </section>)}
    <div className="flex gap-3"><button disabled={ocupado || dados.pagina <= 1} onClick={() => void executar(() => carregar(dados.pagina - 1))}>Anterior</button><span>Página {dados.pagina}</span><button disabled={ocupado || !dados.temProxima} onClick={() => void executar(() => carregar(dados.pagina + 1))}>Próxima</button></div>
  </div>;
}
