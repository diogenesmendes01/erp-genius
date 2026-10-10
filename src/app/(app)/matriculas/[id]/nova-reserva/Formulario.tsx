"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatarMoeda } from "@/lib/dinheiro";
import { rotular, STATUS_COBRANCA_LABEL, TIPO_COBRANCA_LABEL, TIPO_PAGADOR_LABEL } from "@/lib/labels";
import { consultarFormularioNovaReserva, revisarNovaReservaParticular, confirmarNovaReservaParticular } from "@/server/matricula/nova-reserva-particular";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { CampoFuso } from "@/components/CampoFuso";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
type Base = NonNullable<Extract<Awaited<ReturnType<typeof consultarFormularioNovaReserva>>, { ok: true }>["dado"]>;
type Revisao = NonNullable<Extract<Awaited<ReturnType<typeof revisarNovaReservaParticular>>, { ok: true }>["dado"]>;
export function NovaReservaFormulario({ base }: { base: Base }) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const [professores, setProfessores] = useState(base.professores), [pagina, setPagina] = useState(1), [mais, setMais] = useState(base.temProxima);
  const [busca, setBusca] = useState(""), [professorId, setProfessor] = useState(""), [fuso, setFuso] = useState(base.fuso);
  const [encontros, setEncontros] = useState([{ data: "", horario: "", duracao: "" }]);
  const [revisao, setRevisao] = useState<Revisao | null>(null), [conferido, setConferido] = useState(false), [motivo, setMotivo] = useState("");
  // Três grupos de ação, cada um com o erro junto do próprio botão (docs/42 E3). Consulta e revisão só
  // leem: na falha de transporte, a mensagem fixa de cada uma. A confirmação tem chave de idempotência
  // estável (reaproveitada depois de erro ou falha): reenviar confere a mesma operação (MSG_RESULTADO_INCERTO).
  const acaoConsulta = useAcaoCliente({ idempotente: false });
  const acaoRevisao = useAcaoCliente({ idempotente: false });
  const acaoConfirmacao = useAcaoCliente({ idempotente: true });
  const ocupado = acaoConsulta.ocupado || acaoRevisao.ocupado || acaoConfirmacao.ocupado;
  function invalidar() { setRevisao(null); setConferido(false); chave.current = null; }
  const entrada = () => ({ matriculaId: base.matriculaId, anteriorId: base.anteriorId, agenda: { ofertaId: base.ofertaId, versaoOferta: base.versaoOferta, professorId, fusoOrigem: fuso.trim(), encontros: encontros.map((e) => ({ data: e.data, horario: e.horario, duracaoMinutos: Number(e.duracao) })) } });
  async function buscar(p: number) {
    invalidar(); setProfessor(""); acaoRevisao.limpar(); acaoConfirmacao.limpar();
    const d = await acaoConsulta.executar(async (): Promise<Resultado<Base>> => {
      const r = await consultarFormularioNovaReserva({ matriculaId: base.matriculaId, buscaProfessor: busca, pagina: p });
      if (!r.ok) return r;
      if (!r.dado) return { ok: false, erro: "Consulta indisponível." };
      if (r.dado.anteriorId !== base.anteriorId || r.dado.versaoOferta !== base.versaoOferta) return { ok: false, erro: "A preparação mudou. Atualize a página." };
      return { ok: true, dado: r.dado };
    });
    if (d?.tipo === "incerto") acaoConsulta.setErro("Não foi possível consultar professores.");
    if (d?.tipo === "ok" && d.dado) { setProfessores(d.dado.professores); setPagina(p); setMais(d.dado.temProxima); }
  }
  async function revisar() {
    invalidar(); acaoConsulta.limpar(); acaoConfirmacao.limpar();
    const d = await acaoRevisao.executar(async (): Promise<Resultado<Revisao>> => {
      const r = await revisarNovaReservaParticular(entrada());
      if (!r.ok) return r;
      if (!r.dado) return { ok: false, erro: "Revisão indisponível." };
      return { ok: true, dado: r.dado };
    });
    if (d?.tipo === "incerto") acaoRevisao.setErro("Não foi possível revisar a reserva.");
    if (d?.tipo === "ok" && d.dado) setRevisao(d.dado);
  }
  async function confirmar() {
    if (!revisao || !conferido) return;
    acaoConsulta.limpar(); acaoRevisao.limpar();
    chave.current ??= crypto.randomUUID();
    const chaveIdempotencia = chave.current, revisaoHash = revisao.revisaoHash;
    const d = await acaoConfirmacao.executar(
      () => confirmarNovaReservaParticular({ ...entrada(), revisaoHash, motivo, chaveIdempotencia, dadosConferidos: true }),
      "Nova reserva confirmada. Abrindo a preparação da matrícula.",
    );
    if (d?.tipo === "ok") { router.push(`/matriculas/${base.matriculaId}/preparacao`); router.refresh(); }
  }
  const data = (v: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: revisao?.agenda.fuso ?? "UTC" }).format(new Date(v));
  return <div className="space-y-4"><fieldset disabled={ocupado} className="space-y-3">
    <legend>{base.formaAgenda === "PARTICULAR_GRADE_FIXA" ? "Informe todos os encontros recorrentes acordados" : "Reserve ao menos o primeiro encontro; os seguintes dependem de agendamento"}</legend>
    <label className="block">Buscar professor<input value={busca} onChange={(e) => setBusca(e.target.value)} className="block border p-2" /></label><button type="button" onClick={() => buscar(1)} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Buscar</button>
    <div>{pagina > 1 && <button type="button" className={botaoClasses({ variante: "secundario" })} onClick={() => buscar(pagina - 1)}>Professores anteriores</button>} {mais && <button type="button" className={botaoClasses({ variante: "secundario" })} onClick={() => buscar(pagina + 1)}>Mais professores</button>}</div>
    <FeedbackAcao erro={acaoConsulta.erro} />
    <label className="block">Professor<select value={professorId} onChange={(e) => { setProfessor(e.target.value); invalidar(); }} className="block border p-2"><option value="">Selecione</option>{professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <label className="block">Fuso dos horários<CampoFuso name="fusoOrigem" valor={fuso} onChange={(valor) => { setFuso(valor); invalidar(); }} required={false} className="block border p-2" /><span>Exemplo: America/Sao_Paulo</span></label>
    {encontros.map((e, i) => <fieldset key={i} className="flex flex-wrap gap-3 rounded border p-3"><legend>Encontro {i + 1}</legend>{(["data", "horario", "duracao"] as const).map((campo) => <label key={campo}>{campo === "data" ? "Data" : campo === "horario" ? "Horário" : "Duração em minutos"}<input type={campo === "data" ? "date" : campo === "horario" ? "time" : "number"} min={campo === "duracao" ? 1 : undefined} max={campo === "duracao" ? 1440 : undefined} value={e[campo]} onChange={(event) => { setEncontros(encontros.map((v, j) => j === i ? { ...v, [campo]: event.target.value } : v)); invalidar(); }} className="block border p-2" /></label>)}<button type="button" className={botaoClasses({ variante: "perigo" })} disabled={encontros.length === 1} onClick={() => { setEncontros(encontros.filter((_, j) => j !== i)); invalidar(); }}>Remover</button></fieldset>)}
    <button type="button" disabled={encontros.length >= 1000} onClick={() => { setEncontros([...encontros, { data: "", horario: "", duracao: "" }]); invalidar(); }} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Adicionar encontro</button>
    <button type="button" onClick={revisar} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Revisar horários e condições</button>
    <FeedbackAcao erro={acaoRevisao.erro} />
    {revisao && <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Conferência da retomada</h2>
      <p>{revisao.aluno.primeiroNome} {revisao.aluno.sobrenome} · Documento: {revisao.aluno.documento ?? "Não informado"}</p><p>{revisao.aluno.email} · {revisao.aluno.telefoneE164}</p><p>{[revisao.aluno.rua, revisao.aluno.numero, revisao.aluno.cidade, revisao.aluno.regiao, revisao.aluno.cep, revisao.aluno.paisResidencia].filter(Boolean).join(", ")}</p>
      <p>Pagador: {rotular(TIPO_PAGADOR_LABEL, revisao.pagador.tipo)} · versão {revisao.pagador.versao}. Condições: versão {revisao.versaoCondicoes}.</p>
      <p>{revisao.pagador.dados.nome} · {revisao.pagador.dados.documento ?? "Documento não informado"} · {revisao.pagador.dados.email} · {revisao.pagador.dados.telefoneE164}</p><p>{revisao.pagador.dados.endereco}</p>
      <ul>{revisao.agenda.encontros.map((e, i) => <li key={i}>{data(e.inicio)} — {data(e.fim)} · {revisao.agenda.fuso}</li>)}</ul>
      <h3>Cobranças existentes — não serão reemitidas</h3><ul>{revisao.cobrancas.map((c) => <li key={c.id}>{rotular(TIPO_COBRANCA_LABEL, c.tipo)} · {formatarMoeda(c.valorNegociado, c.moeda)} · saldo {c.saldo == null ? "a conferir" : formatarMoeda(c.saldo, c.moeda)} · {rotular(STATUS_COBRANCA_LABEL, c.status)} · {c.informesPendentes} comprovante(s) pendente(s)</li>)}</ul>
      <h3>Condições de entrada registradas</h3><ul>{revisao.plano.map((p) => <li key={p.tipo}>{rotular(TIPO_COBRANCA_LABEL, p.tipo)} · {formatarMoeda(p.valor, p.moeda)} · vencimento {formatarDataCivil(p.vencimento)}{p.cobertura ? ` · cobertura ${formatarDataCivil(p.cobertura.inicio)} a ${formatarDataCivil(p.cobertura.fim)}` : ""}</li>)}</ul>
      <label className="block">Motivo<CampoTexto value={motivo} onChange={(e) => { setMotivo(e.target.value); chave.current = null; }} minLength={5} maxLength={2000} className="block w-full border p-2" /></label>
      <label className="block"><input type="checkbox" checked={conferido} onChange={(e) => setConferido(e.target.checked)} /> Conferi cadastro, pagador, condições, cobranças e todos os horários acordados.</label>
      <button type="button" disabled={!conferido || motivo.trim().length < 5} onClick={confirmar} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Confirmar nova reserva</button>
      <FeedbackAcao erro={acaoConfirmacao.erro} sucesso={acaoConfirmacao.sucesso} />
    </section>}
  </fieldset></div>;
}
