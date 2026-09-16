"use client";
import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirAditivoContratual, prepararAditivoContratual } from "@/server/contratos/aditivos";
import type { OrigemCampo } from "@/server/contratos/campos";
import { representarValorAlteracaoAditivo, validarValorAlteracaoAditivo } from "@/server/contratos/aditivo-valores";
import { ValorEstruturadoCampo } from "./ValorEstruturadoCampo";

type Fonte = { conclusaoId: string; conclusaoHash: string; campos: { origem: OrigemCampo; rotulo: string; anterior: string }[] };
type Modelo = { id: string; codigo: string; versao: number; modeloHash: string; titulo: string };
const acompanharFuso = () => () => {};
const fusoNavegador = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "fuso local do navegador";
const fusoServidor = () => null;

export function PrepararAditivo({ matriculaId, fonte, modelos }: { matriculaId: string; fonte: Fonte; modelos: Modelo[] }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState(""), [chave, setChave] = useState(() => crypto.randomUUID()), [tentativa, setTentativa] = useState<string | null>(null);
  const id = useId();
  const [modeloId, setModeloId] = useState(""), [valoresEstruturados, setValoresEstruturados] = useState<Partial<Record<OrigemCampo, unknown>>>({}); const modelo = modelos.find(m => m.id === modeloId);
  const fuso = useSyncExternalStore<string | null>(acompanharFuso, fusoNavegador, fusoServidor);
  return <form className="space-y-4 rounded border p-4" onSubmit={e => {
    e.preventDefault(); const dados = new FormData(e.currentTarget), vigenciaLocal = String(dados.get("vigencia") ?? ""), instante = new Date(vigenciaLocal);
    const alteracoes: { origem: OrigemCampo; novo: string; valorEstruturado?: ReturnType<typeof validarValorAlteracaoAditivo> }[] = [];
    for (const c of fonte.campos) {
      if (dados.get(`alterar:${c.origem}`) !== "on") continue;
      const valorEstruturado = valoresEstruturados[c.origem];
      if (c.origem !== "AGENDA_PARTICULAR" && valorEstruturado !== undefined) {
        try {
          const validado = validarValorAlteracaoAditivo(c.origem, valorEstruturado);
          alteracoes.push({ origem: c.origem, novo: representarValorAlteracaoAditivo(validado), valorEstruturado: validado });
        } catch { setMensagem(`Preencha o novo valor de ${c.rotulo} conforme indicado.`); return; }
      } else alteracoes.push({ origem: c.origem, novo: String(dados.get(`novo:${c.origem}`) ?? "").trim() });
    }
    if (!modelo || !vigenciaLocal || Number.isNaN(instante.getTime()) || !alteracoes.length || alteracoes.some(a => !a.novo)) { setMensagem("Selecione o modelo, a vigência e ao menos uma condição com novo valor."); return; }
    const vigenciaInicio = instante.toISOString(), conteudo = JSON.stringify({ modeloId: modelo.id, vigenciaInicio, alteracoes, motivo: String(dados.get("motivo") ?? "") });
    const chaveAtual = tentativa && tentativa !== conteudo ? crypto.randomUUID() : chave;
    if (chaveAtual !== chave) setChave(chaveAtual); if (tentativa !== conteudo) setTentativa(conteudo);
    setMensagem(""); iniciar(async () => {
      try {
      const r = await prepararAditivoContratual({ matriculaId, conclusaoOriginalId: fonte.conclusaoId, conclusaoHashEsperado: fonte.conclusaoHash,
        modeloId: modelo.id, modeloHashEsperado: modelo.modeloHash, vigenciaInicio, alteracoes, motivo: String(dados.get("motivo") ?? ""), chaveIdempotencia: chaveAtual });
      if (!r.ok) setMensagem(r.erro); else if (r.dado) router.push(`/matriculas/${encodeURIComponent(matriculaId)}/contrato/aditivos/${encodeURIComponent(r.dado.id)}`);
      } catch { setMensagem("Não foi possível confirmar o registro. Tente novamente sem alterar os dados para consultar o resultado da mesma tentativa."); }
    });
  }}>
    <h2 className="text-xl">Preparar proposta de aditivo</h2>
    <div className="block"><label htmlFor={`${id}-modelo`}>Modelo institucional aprovado</label><select id={`${id}-modelo`} className="mt-1 block w-full rounded border p-2" value={modeloId} onChange={e => setModeloId(e.target.value)} required disabled={pendente}><option value="">Selecione um modelo</option>{modelos.map(m => <option key={m.id} value={m.id}>{m.codigo} · versão {m.versao} · {m.titulo}</option>)}</select></div>
    <fieldset className="space-y-3"><legend className="font-medium">Condições do original que serão alteradas</legend>{fonte.campos.map(c => <div key={c.origem} className="rounded border p-3"><div><input id={`${id}-${c.origem}`} type="checkbox" name={`alterar:${c.origem}`} disabled={pendente} /> <label htmlFor={`${id}-${c.origem}`}>Alterar {c.rotulo}</label></div><p>Valor preservado: {c.anterior}</p>{c.origem === "AGENDA_PARTICULAR" ? <div className="block"><label htmlFor={`${id}-novo-${c.origem}`}>Nova descrição da agenda</label><input id={`${id}-novo-${c.origem}`} className="mt-1 block w-full rounded border p-2" name={`novo:${c.origem}`} maxLength={4000} disabled={pendente} /></div> : <div className="mt-2"><ValorEstruturadoCampo campo={c.origem} rotulo={`Novo valor para ${c.rotulo}`} disabled={pendente} onChange={valor => setValoresEstruturados(anteriores => ({ ...anteriores, [c.origem]: valor }))} /></div>}</div>)}</fieldset>
    <label className="block">Início da vigência<input className="mt-1 block rounded border p-2" type="datetime-local" name="vigencia" required disabled={pendente} /></label>
    <p role="status">{fuso ? `Informe a vigência no fuso ${fuso}. O instante correspondente será preservado no registro.` : "Identificando o fuso do navegador…"}</p>
    <label className="block">Motivo<textarea className="mt-1 block w-full rounded border p-2" name="motivo" minLength={5} maxLength={4000} required disabled={pendente} /></label>
    <p>Esta proposta não altera condições, não emite taxa e não cria matrícula. Outra pessoa da Administração ainda precisa decidir.</p>
    {mensagem && <p role="alert">{mensagem}</p>}<button className="rounded border px-4 py-2" disabled={pendente || !modelo}>{pendente ? "Registrando…" : "Registrar proposta de aditivo"}</button>
  </form>;
}

export function DecidirAditivo({ propostaId, propostaHash, superada }: { propostaId: string; propostaHash: string; superada: boolean }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={e => { e.preventDefault(); const dados = new FormData(e.currentTarget), decisao = dados.get("decisao"); if (decisao !== "aprovar" && decisao !== "rejeitar") { setMensagem("Escolha uma decisão."); return; } setMensagem(""); iniciar(async () => {
    try {
    const r = await decidirAditivoContratual({ propostaId, propostaHashEsperado: propostaHash, aprovada: decisao === "aprovar", motivo: String(dados.get("motivo") ?? "") });
    if (!r.ok) setMensagem(r.erro); else { setMensagem("Decisão registrada."); router.refresh(); }
    } catch { setMensagem("Não foi possível confirmar a decisão. Confira o histórico ou repita a mesma decisão."); }
  }); }}>
    <h2 className="text-xl">Decisão administrativa</h2><label className="block"><input type="checkbox" required disabled={pendente} /> Conferi o original, as alterações e a vigência desta proposta.</label>
    <label className="block">Decisão<select className="mt-1 block rounded border p-2" name="decisao" defaultValue="" required disabled={pendente}><option value="">Selecione</option><option value="aprovar" disabled={superada}>Aprovar proposta</option><option value="rejeitar">Rejeitar proposta</option></select></label>
    <label className="block">Justificativa<textarea className="mt-1 block w-full rounded border p-2" name="motivo" minLength={5} maxLength={4000} required disabled={pendente} /></label>
    {mensagem && <p role="status">{mensagem}</p>}<button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Registrando…" : "Registrar decisão"}</button>
  </form>;
}
