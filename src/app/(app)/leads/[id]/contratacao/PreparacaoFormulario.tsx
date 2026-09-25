"use client";
import { AgendaParticularFormulario, type AgendaConferida } from "./AgendaParticularFormulario";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepararContratacao, prepararContratacaoNovaPessoa } from "@/server/matricula/preparacao-comercial";
import { parseMoeda } from "@/lib/dinheiro";
import { CampoMoeda } from "@/components/CampoMoeda";
import { botaoClasses } from "@/components/Botao";
export function PreparacaoFormulario({ leadId, oferta, candidatos, turmas, novaPessoa, paises }: { novaPessoa: boolean; paises: { id: string; nome: string }[]; leadId: string; oferta: { id: string; versaoEntrada: number; formaAgenda: string | null; produtoId: string; paisId: string; moeda: string }; candidatos: { id: string; primeiroNome: string; sobrenome: string | null }[]; turmas: { id: string; nome: string }[] }) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const particular = oferta.formaAgenda?.startsWith("PARTICULAR_") ?? false;
  const [agendaParticular, setAgendaParticular] = useState<AgendaConferida | null>(null);
  const [regime, setRegime] = useState("");
  const [taxa, setTaxa] = useState(""); const [servico, setServico] = useState("");
  const [erro, setErro] = useState(""); const [ocupado, iniciar] = useTransition();
  return <form className="space-y-4 rounded border p-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
    if (f.get("confirmacao") !== "on") { setErro("Confirme a identidade do cadastro selecionado."); return; }
    if (particular && !agendaParticular) { setErro("Confira e confirme os horários particulares antes de preparar."); return; }
    const taxaNumero = parseMoeda(taxa), servicoNumero = parseMoeda(servico);
    if (taxaNumero === null || servicoNumero === null) { setErro("Informe a taxa e o valor propostos, com no máximo duas casas decimais."); return; }
    iniciar(async () => { try { chave.current ??= crypto.randomUUID();
      const comum = { minutosAdiantamento: f.get("minutosAdiantamento") ? Number(f.get("minutosAdiantamento")) : undefined, leadId, produtoId: oferta.produtoId, paisId: oferta.paisId, turmaId: particular ? undefined : String(f.get("turma")), agendaParticular: particular ? agendaParticular! : undefined, regime: String(f.get("regime")) as "MENSALIDADE" | "HORA_PARTICULAR", taxaProposta: taxaNumero.toFixed(2), valorServicoProposto: servicoNumero.toFixed(2), motivo: String(f.get("motivo")), chaveIdempotencia: chave.current };
      const r = novaPessoa ? await prepararContratacaoNovaPessoa({ ...comum, cadastroNovoConferido: true, novoCadastro: { primeiroNome: String(f.get("primeiroNome")), sobrenome: String(f.get("sobrenome") ?? "").trim() || undefined, email: String(f.get("email") ?? "").trim() || undefined, paisId: String(f.get("paisCadastro")) } }) : await prepararContratacao({ ...comum, alunoId: String(f.get("aluno")), identidadeConferida: true });
      if (!r.ok || !r.dado) { setErro(r.ok ? "Preparação não confirmada." : r.erro); return; }
      router.push(`/matriculas/${r.dado.matriculaId}/preparacao`);
    } catch { setErro("Resultado não confirmado. Reenvie os mesmos dados para conferir a tentativa."); } }); }}>
    <fieldset disabled={ocupado} className="space-y-4">
    {novaPessoa ? <fieldset className="space-y-3"><legend>Cadastro básico de pessoa nova</legend>
      <label className="block">Primeiro nome<input name="primeiroNome" required maxLength={100} className="block rounded border p-2" /></label>
      <label className="block">Sobrenome<input name="sobrenome" maxLength={150} className="block rounded border p-2" /></label>
      <label className="block">E-mail (opcional)<input name="email" type="email" maxLength={254} className="block rounded border p-2" /></label>
      <label className="block">País do cadastro<select name="paisCadastro" required defaultValue="" className="block rounded border p-2"><option value="" disabled>Selecione o país da pessoa</option>{paises.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <p>O telefone será o contato registrado na negociação. A Secretaria complementa documentos e dados administrativos.</p>
    </fieldset> : <>    <label className="block">Cadastro do aluno<select name="aluno" required defaultValue="" className="block w-full rounded border p-2"><option value="" disabled>Selecione após conferir a identidade</option>{candidatos.map((a) => <option key={a.id} value={a.id}>{a.primeiroNome} {a.sobrenome}</option>)}</select></label>
</>}
    <label className="flex items-center gap-2"><input type="checkbox" name="confirmacao" required />{novaPessoa ? "Conferi os dados e a necessidade de cadastrar uma pessoa nova." : "Conferi que o cadastro selecionado corresponde à pessoa desta contratação."}</label>
    {particular ? <AgendaParticularFormulario leadId={leadId} ofertaId={oferta.id} versaoOferta={oferta.versaoEntrada} fixa={oferta.formaAgenda === "PARTICULAR_GRADE_FIXA"} onChange={setAgendaParticular} /> : <label className="block">Turma<select name="turma" required defaultValue="" className="block w-full rounded border p-2"><option value="" disabled>Escolha uma turma disponível</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>}
    <label className="block">Cobrança proposta<select name="regime" required value={regime} onChange={(e) => setRegime(e.target.value)} className="block w-full rounded border p-2"><option value="" disabled>Selecione o regime</option><option value="MENSALIDADE">Mensalidade fixa</option><option value="HORA_PARTICULAR">Por hora de 60 minutos</option></select></label>
    <label className="block">Taxa de matrícula proposta ({oferta.moeda})<CampoMoeda value={taxa} onChange={setTaxa} moeda={oferta.moeda} required className="block rounded border p-2" /></label>
    <label className="block">Valor proposto por mensalidade ou hora ({oferta.moeda})<CampoMoeda value={servico} onChange={setServico} moeda={oferta.moeda} required className="block rounded border p-2" /></label>
    {regime === "HORA_PARTICULAR" && <label className="block">Minutos contratados para antecipação inicial<input name="minutosAdiantamento" type="number" min="1" step="1" max="2147483647" className="block rounded border p-2" /><span>Obrigatório quando a oferta exige adiantamento. Valor calculado pelo preço por hora informado, sem arredondar o tempo para cima.</span></label>}
    <label className="block">Condições propostas e motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <p>Valores propostos ficam sujeitos à conferência e às aprovações aplicáveis. Este envio reserva a vaga ou os horários conferidos e não emite cobrança ou contrato para assinatura.</p>
    <button disabled={ocupado || (!novaPessoa && !candidatos.length) || (particular ? !agendaParticular : !turmas.length)} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Conferindo e preparando…" : "Preparar contratação e reservar"}</button>{erro && <p role="alert">{erro}</p>}
    </fieldset>
  </form>;
}
