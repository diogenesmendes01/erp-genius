"use client";
import { AgendaParticularFormulario, type AgendaConferida } from "./AgendaParticularFormulario";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepararContratacao, prepararContratacaoNovaPessoa } from "@/server/matricula/preparacao-comercial";
import { parseMoeda } from "@/lib/dinheiro";
import { CampoMoeda } from "@/components/CampoMoeda";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { garantirEstilo } from "@/app/(app)/inbox/garantir-estilo";
const CAMPO = "block w-full rounded-md border border-gray-200 bg-surface p-2";
export function PreparacaoFormulario({ leadId, oferta, candidatos, turmas, novaPessoa, paises, sugestaoNovoCadastro = null }: { novaPessoa: boolean; paises: { id: string; nome: string }[]; sugestaoNovoCadastro?: { primeiroNome: string; sobrenome: string; email: string; paisId: string } | null; leadId: string; oferta: { id: string; versaoEntrada: number; formaAgenda: string | null; produtoId: string; paisId: string; moeda: string }; candidatos: { id: string; primeiroNome: string; sobrenome: string | null }[]; turmas: { id: string; nome: string }[] }) {
  garantirEstilo();
  const router = useRouter(), chave = useRef<string | null>(null);
  const particular = oferta.formaAgenda?.startsWith("PARTICULAR_") ?? false;
  const [agendaParticular, setAgendaParticular] = useState<AgendaConferida | null>(null);
  const [regime, setRegime] = useState("");
  const [taxa, setTaxa] = useState(""); const [servico, setServico] = useState("");
  const [erro, setErro] = useState(""); const [ocupado, iniciar] = useTransition();
  const [aluno, setAluno] = useState<{ id: string; nome: string } | null>(null);
  const [turma, setTurma] = useState<{ id: string; nome: string } | null>(null);
  const [conferido, setConferido] = useState(false);
  const nomeDoCandidato = (a: { primeiroNome: string; sobrenome: string | null }) => `${a.primeiroNome} ${a.sobrenome ?? ""}`.trim();
  const agendaValida = agendaParticular && agendaParticular.versaoOferta === oferta.versaoEntrada ? agendaParticular : null;
  return <form className="space-y-4 rounded border p-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
    if (f.get("confirmacao") !== "on") { setErro("Confirme a identidade do cadastro selecionado."); return; }
    if (particular && !agendaValida) { setErro("Confira e confirme os horários particulares antes de preparar."); return; }
    const taxaNumero = parseMoeda(taxa), servicoNumero = parseMoeda(servico);
    if (taxaNumero === null || servicoNumero === null) { setErro("Informe a taxa e o valor propostos, com no máximo duas casas decimais."); return; }
    iniciar(async () => { try { chave.current ??= crypto.randomUUID();
      const comum = { minutosAdiantamento: f.get("minutosAdiantamento") ? Number(f.get("minutosAdiantamento")) : undefined, leadId, produtoId: oferta.produtoId, paisId: oferta.paisId, turmaId: particular ? undefined : turma?.id, agendaParticular: particular ? agendaValida! : undefined, regime: String(f.get("regime")) as "MENSALIDADE" | "HORA_PARTICULAR", taxaProposta: taxaNumero.toFixed(2), valorServicoProposto: servicoNumero.toFixed(2), motivo: String(f.get("motivo")), chaveIdempotencia: chave.current };
      const r = novaPessoa ? await prepararContratacaoNovaPessoa({ ...comum, cadastroNovoConferido: true, novoCadastro: { primeiroNome: String(f.get("primeiroNome")), sobrenome: String(f.get("sobrenome") ?? "").trim() || undefined, email: String(f.get("email") ?? "").trim() || undefined, paisId: String(f.get("paisCadastro")) } }) : await prepararContratacao({ ...comum, alunoId: aluno?.id ?? "", identidadeConferida: true });
      if (!r.ok || !r.dado) { setErro(r.ok ? "Preparação não confirmada." : r.erro); return; }
      router.push(`/matriculas/${r.dado.matriculaId}/preparacao`);
    } catch { setErro(MSG_RESULTADO_INCERTO); } }); }}>
    <fieldset disabled={ocupado} className="space-y-4">
    {novaPessoa ? <fieldset className="space-y-3"><legend>Cadastro básico de pessoa nova</legend>
      <label className="block">Primeiro nome<input name="primeiroNome" required maxLength={100} defaultValue={sugestaoNovoCadastro?.primeiroNome ?? ""} className="block rounded border p-2" /></label>
      <label className="block">Sobrenome<input name="sobrenome" maxLength={150} defaultValue={sugestaoNovoCadastro?.sobrenome ?? ""} className="block rounded border p-2" /></label>
      <label className="block">E-mail (opcional)<input name="email" type="email" maxLength={254} defaultValue={sugestaoNovoCadastro?.email ?? ""} className="block rounded border p-2" /></label>
      <label className="block">País do cadastro<Combobox name="paisCadastro" required defaultValue={sugestaoNovoCadastro?.paisId ?? ""} vazio="Selecione o país da pessoa" busca="Buscar país" className={CAMPO} opcoes={paises.map((p) => ({ valor: p.id, rotulo: p.nome }))} /></label>
      <p>O telefone será o contato registrado na negociação. A Secretaria complementa documentos e dados administrativos.</p>
    </fieldset> : <>    <label className="block">Cadastro do aluno<Combobox name="aluno" aria-label="Cadastro do aluno" required value={aluno?.id ?? ""} vazio="Selecione após conferir a identidade" busca="Buscar cadastro" onValueChange={(valor) => { const a = candidatos.find((c) => c.id === valor); setAluno(a ? { id: a.id, nome: nomeDoCandidato(a) } : aluno?.id === valor ? aluno : null); }} className={CAMPO} opcoes={[...(aluno && !candidatos.some((a) => a.id === aluno.id) ? [{ valor: aluno.id, rotulo: aluno.nome }] : []), ...candidatos.map((a) => ({ valor: a.id, rotulo: nomeDoCandidato(a) }))]} /></label>
</>}
    <label className="flex items-center gap-2"><Checkbox name="confirmacao" required checked={conferido} onCheckedChange={(marcado) => setConferido(marcado === true)} />{novaPessoa ? "Conferi os dados e a necessidade de cadastrar uma pessoa nova." : "Conferi que o cadastro selecionado corresponde à pessoa desta contratação."}</label>
    {particular ? <AgendaParticularFormulario leadId={leadId} ofertaId={oferta.id} versaoOferta={oferta.versaoEntrada} fixa={oferta.formaAgenda === "PARTICULAR_GRADE_FIXA"} onChange={setAgendaParticular} /> : <label className="block">Turma<Combobox name="turma" aria-label="Turma" required value={turma?.id ?? ""} vazio="Escolha uma turma disponível" busca="Buscar turma" onValueChange={(valor) => { const t = turmas.find((x) => x.id === valor); setTurma(t ? { id: t.id, nome: t.nome } : turma?.id === valor ? turma : null); }} className={CAMPO} opcoes={[...(turma && !turmas.some((t) => t.id === turma.id) ? [{ valor: turma.id, rotulo: turma.nome }] : []), ...turmas.map((t) => ({ valor: t.id, rotulo: t.nome }))]} /></label>}
    <label className="block">Cobrança proposta<Combobox name="regime" aria-label="Cobrança proposta" required value={regime} vazio="Selecione o regime" onValueChange={setRegime} className={CAMPO} opcoes={[{ valor: "MENSALIDADE", rotulo: "Mensalidade fixa" }, { valor: "HORA_PARTICULAR", rotulo: "Por hora de 60 minutos" }]} /></label>
    <label className="block">Taxa de matrícula proposta ({oferta.moeda})<CampoMoeda value={taxa} onChange={setTaxa} moeda={oferta.moeda} required className="block rounded border p-2" /></label>
    <label className="block">Valor proposto por mensalidade ou hora ({oferta.moeda})<CampoMoeda value={servico} onChange={setServico} moeda={oferta.moeda} required className="block rounded border p-2" /></label>
    {regime === "HORA_PARTICULAR" && <label className="block">Minutos contratados para antecipação inicial<input name="minutosAdiantamento" type="number" min="1" step="1" max="2147483647" className="block rounded border p-2" /><span>Obrigatório quando a oferta exige adiantamento. Valor calculado pelo preço por hora informado, sem arredondar o tempo para cima.</span></label>}
    <label className="block">Condições propostas e motivo<CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <p>Valores propostos ficam sujeitos à conferência e às aprovações aplicáveis. Este envio reserva a vaga ou os horários conferidos e não emite cobrança ou contrato para assinatura.</p>
    <button disabled={ocupado || (!aluno && !novaPessoa && !candidatos.length) || (particular ? !agendaValida : !turma && !turmas.length)} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Conferindo e preparando…" : "Preparar contratação e reservar"}</button>{erro && <p role="alert">{erro}</p>}
    </fieldset>
  </form>;
}
