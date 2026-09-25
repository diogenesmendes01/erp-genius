"use client";
import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirAditivoContratual, prepararAditivoContratual } from "@/server/contratos/aditivos";
import type { OrigemCampo } from "@/server/contratos/campos";
import { representarValorAlteracaoAditivo, validarValorAlteracaoAditivo } from "@/server/contratos/aditivo-valores";
import { ValorEstruturadoCampo } from "./ValorEstruturadoCampo";
import { CicloCoberturaFuturoAditivoSchema } from "@/server/contratos/aditivo-schema";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";

type Fonte = { conclusaoId: string; conclusaoHash: string; campos: { origem: OrigemCampo; rotulo: string; anterior: string }[] };
type Modelo = { id: string; codigo: string; versao: number; modeloHash: string; titulo: string };
const acompanharFuso = () => () => {};
const fusoNavegador = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "fuso local do navegador";
const fusoServidor = () => null;

export function PrepararAditivo({ matriculaId, fonte, modelos, agenda }: { matriculaId: string; fonte: Fonte; modelos: Modelo[]; agenda?: { id: string; texto: string; pendencias: string[] } | null }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState(""), [chave, setChave] = useState(() => crypto.randomUUID()), [tentativa, setTentativa] = useState<string | null>(null);
  const id = useId();
  const [escolhaCiclo, setEscolhaCiclo] = useState("");
  const [modeloId, setModeloId] = useState(""), [valoresEstruturados, setValoresEstruturados] = useState<Partial<Record<OrigemCampo, unknown>>>({}); const modelo = modelos.find(m => m.id === modeloId);
  const fuso = useSyncExternalStore<string | null>(acompanharFuso, fusoNavegador, fusoServidor);
  return <form className="space-y-4 rounded border p-4" onSubmit={e => {
    e.preventDefault(); const dados = new FormData(e.currentTarget), vigenciaLocal = String(dados.get("vigencia") ?? ""), instante = new Date(vigenciaLocal);
    const alteracoes: { origem: OrigemCampo; novo: string; valorEstruturado?: ReturnType<typeof validarValorAlteracaoAditivo> }[] = [];
    for (const c of fonte.campos) {
      if (dados.get(`alterar:${c.origem}`) !== "on") continue;
      const valorEstruturado = valoresEstruturados[c.origem];
      if (c.origem === "AGENDA_PARTICULAR" && agenda) {
        alteracoes.push({ origem: c.origem, novo: agenda.texto, valorEstruturado: { tipo: "AGENDA", propostaAgendaId: agenda.id, texto: agenda.texto } });
      } else if (c.origem !== "AGENDA_PARTICULAR" && valorEstruturado !== undefined) {
        try {
          const validado = validarValorAlteracaoAditivo(c.origem, valorEstruturado);
          alteracoes.push({ origem: c.origem, novo: representarValorAlteracaoAditivo(validado), valorEstruturado: validado });
        } catch { setMensagem(`Preencha o novo valor de ${c.rotulo} conforme indicado.`); return; }
      } else alteracoes.push({ origem: c.origem, novo: String(dados.get(`novo:${c.origem}`) ?? "").trim() });
    }
    if (!modelo || !vigenciaLocal || Number.isNaN(instante.getTime()) || !alteracoes.length || alteracoes.some(a => !a.novo)) { setMensagem("Selecione o modelo, a vigência e ao menos uma condição com novo valor."); return; }
    const alteraCobertura = alteracoes.some(a => a.origem === "COBERTURA_INICIO" || a.origem === "COBERTURA_FIM");
    const ciclo = alteraCobertura ? CicloCoberturaFuturoAditivoSchema.safeParse(escolhaCiclo === "MUDAR_REFERENCIA"
      ? { escolha: escolhaCiclo, referencia: dados.get("referenciaCiclo"), dataReferencia: dados.get("dataReferenciaCiclo") }
      : { escolha: escolhaCiclo }) : null;
    if (ciclo && !ciclo.success) { setMensagem("Escolha como ficam os períodos seguintes e informe uma referência válida quando houver mudança."); return; }
    const politica = ciclo?.success ? { cicloCoberturaFutura: ciclo.data } : {};
    const vigenciaInicio = instante.toISOString(), conteudo = JSON.stringify({ modeloId: modelo.id, vigenciaInicio, alteracoes, ...politica, motivo: String(dados.get("motivo") ?? "") });
    const chaveAtual = tentativa && tentativa !== conteudo ? crypto.randomUUID() : chave;
    if (chaveAtual !== chave) setChave(chaveAtual); if (tentativa !== conteudo) setTentativa(conteudo);
    setMensagem(""); iniciar(async () => {
      try {
      const r = await prepararAditivoContratual({ matriculaId, conclusaoOriginalId: fonte.conclusaoId, conclusaoHashEsperado: fonte.conclusaoHash,
        modeloId: modelo.id, modeloHashEsperado: modelo.modeloHash, vigenciaInicio, alteracoes, ...politica, motivo: String(dados.get("motivo") ?? ""), chaveIdempotencia: chaveAtual });
      if (!r.ok) setMensagem(r.erro); else if (r.dado) router.push(`/matriculas/${encodeURIComponent(matriculaId)}/contrato/aditivos/${encodeURIComponent(r.dado.id)}`);
      } catch { setMensagem(MSG_RESULTADO_INCERTO); }
    });
  }}>
    <h2 className="text-xl">Preparar proposta de aditivo</h2>
    <div className="block"><label htmlFor={`${id}-modelo`}>Modelo institucional aprovado</label><select id={`${id}-modelo`} className="mt-1 block w-full rounded border p-2" value={modeloId} onChange={e => setModeloId(e.target.value)} required disabled={pendente}><option value="">Selecione um modelo</option>{modelos.map(m => <option key={m.id} value={m.id}>{m.codigo} · versão {m.versao} · {m.titulo}</option>)}</select></div>
    <fieldset className="space-y-3"><legend className="font-medium">Condições do original que serão alteradas</legend>{fonte.campos.map(c => <div key={c.origem} className="rounded border p-3"><div><input id={`${id}-${c.origem}`} type="checkbox" name={`alterar:${c.origem}`} defaultChecked={c.origem === "AGENDA_PARTICULAR" && !!agenda} disabled={pendente} /> <label htmlFor={`${id}-${c.origem}`}>Alterar {c.rotulo}</label></div><p>Valor preservado: {c.anterior}</p>{c.origem === "AGENDA_PARTICULAR" ? agenda ? <div className="mt-2"><p className="font-medium">Fotografia selecionada</p><p className="whitespace-pre-wrap">{agenda.texto}</p>{agenda.pendencias.length > 0 && <p role="alert">Esta fotografia tem pendências e não pode ser vinculada.</p>}</div> : <div className="block"><label htmlFor={`${id}-novo-${c.origem}`}>Nova descrição da agenda</label><input id={`${id}-novo-${c.origem}`} className="mt-1 block w-full rounded border p-2" name={`novo:${c.origem}`} maxLength={4000} disabled={pendente} /></div> : <div className="mt-2"><ValorEstruturadoCampo campo={c.origem} rotulo={`Novo valor para ${c.rotulo}`} disabled={pendente} onChange={valor => setValoresEstruturados(anteriores => ({ ...anteriores, [c.origem]: valor }))} /></div>}</div>)}</fieldset>
    {fonte.campos.some(c => c.origem === "COBERTURA_INICIO" || c.origem === "COBERTURA_FIM") && <fieldset className="space-y-3 rounded border p-3" disabled={pendente}>
      <legend className="font-medium">Períodos seguintes à cobertura corrigida</legend>
      <p>Ao alterar a cobertura, informe no aditivo se a referência dos próximos períodos será preservada ou modificada. Selecione início e fim da cobertura juntos.</p>
      <label className="block">Regra do ciclo<select className="mt-1 block rounded border p-2" value={escolhaCiclo} onChange={e => setEscolhaCiclo(e.target.value)}><option value="">Selecione ao alterar a cobertura</option><option value="PRESERVAR_REFERENCIA">Preservar referência vigente</option><option value="MUDAR_REFERENCIA">Mudar referência</option></select></label>
      {escolhaCiclo === "MUDAR_REFERENCIA" && <>
        <label className="block">Referência dos períodos<select className="mt-1 block rounded border p-2" name="referenciaCiclo" defaultValue=""><option value="">Selecione</option><option value="MES_CIVIL">Mês civil</option><option value="CICLO_MATRICULA">Ciclo mensal da matrícula</option></select></label>
        <label className="block">Data de referência<input className="mt-1 block rounded border p-2" type="date" name="dataReferenciaCiclo" /></label>
      </>}
    </fieldset>}
    <label className="block">Início da vigência<input className="mt-1 block rounded border p-2" type="datetime-local" name="vigencia" required disabled={pendente} /></label>
    <p role="status">{fuso ? `Informe a vigência no fuso ${fuso}. O instante correspondente será preservado no registro.` : "Identificando o fuso do navegador…"}</p>
    <label className="block">Motivo<textarea className="mt-1 block w-full rounded border p-2" name="motivo" minLength={5} maxLength={4000} required disabled={pendente} /></label>
    <p>Esta proposta não altera condições, não emite taxa e não cria matrícula. Outra pessoa da Administração ainda precisa decidir.</p>
    {mensagem && <p role="alert">{mensagem}</p>}<button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente || !modelo}>{pendente ? "Registrando…" : "Registrar proposta de aditivo"}</button>
  </form>;
}

export function DecidirAditivo({ propostaId, propostaHash, superada }: { propostaId: string; propostaHash: string; superada: boolean }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={e => { e.preventDefault(); const dados = new FormData(e.currentTarget), decisao = dados.get("decisao"); if (decisao !== "aprovar" && decisao !== "rejeitar") { setMensagem("Escolha uma decisão."); return; } setMensagem(""); iniciar(async () => {
    try {
    const r = await decidirAditivoContratual({ propostaId, propostaHashEsperado: propostaHash, aprovada: decisao === "aprovar", motivo: String(dados.get("motivo") ?? "") });
    if (!r.ok) setMensagem(r.erro); else { setMensagem("Decisão registrada."); router.refresh(); }
    } catch { setMensagem(MSG_DECISAO_INCERTA); }
  }); }}>
    <h2 className="text-xl">Decisão administrativa</h2><label className="block"><input type="checkbox" required disabled={pendente} /> Conferi o original, as alterações e a vigência desta proposta.</label>
    <label className="block">Decisão<select className="mt-1 block rounded border p-2" name="decisao" defaultValue="" required disabled={pendente}><option value="">Selecione</option><option value="aprovar" disabled={superada}>Aprovar proposta</option><option value="rejeitar">Rejeitar proposta</option></select></label>
    <label className="block">Justificativa<textarea className="mt-1 block w-full rounded border p-2" name="motivo" minLength={5} maxLength={4000} required disabled={pendente} /></label>
    <MensagemStatus texto={mensagem} /><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente}>{pendente ? "Registrando…" : "Registrar decisão"}</button>
  </form>;
}
