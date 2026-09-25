"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { conferirParticipantesContratuais, consultarFormularioParticipantes } from "@/server/contratos/participantes";
import { ConferirParticipantesSchema } from "@/server/contratos/participantes-schema";
import { PAPEIS_MODELO } from "@/app/(app)/configuracao/contratos/labels";
import { botaoClasses } from "@/components/Botao";
type Consulta = Awaited<ReturnType<typeof consultarFormularioParticipantes>>;
type Dados = NonNullable<Extract<Consulta, { ok: true }>["dado"]>;
type Participante = z.infer<typeof ConferirParticipantesSchema>["participantes"][number];
export function FormularioParticipantes({ dados }: { dados: Dados }) {
  const router = useRouter(), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false), chave = useRef<string | null>(null);
  const campo = "block w-full rounded border p-2";
  const incompleto = dados.plano.pendencias.length > 0 || dados.participantes.some((p) => p.automatico && !p.identidade);
  return <form className="space-y-4" onSubmit={async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    if (f.get("conferido") !== "on") { setErro("Confirme a identificação das pessoas."); return; }
    const obter = (nome: string) => String(f.get(nome) ?? "");
    const participantes: Participante[] = dados.participantes.map((p) => ({ papel: p.papel,
      identidade: p.automatico ? p.identidade! : { nome: obter(`${p.papel}_nome`), email: obter(`${p.papel}_email`), documento: obter(`${p.papel}_documento`) },
      ...(!p.automatico ? { representacao: { descricao: obter(`${p.papel}_representacao`), evidenciaDocumentoId: obter(`${p.papel}_evidencia`) } } : {}),
    }));
    const input = ConferirParticipantesSchema.safeParse({ previaId: dados.previaId, versaoEsperada: dados.versaoEsperada,
      maioridade: dados.maioridade ? { classificacao: dados.maioridade, criterio: obter("criterio"), evidenciaDocumentoId: obter("evidenciaMaioridade") } : null,
      participantes, identificacoesConferidas: true, motivo: obter("motivo"), chaveIdempotencia: chave.current ??= crypto.randomUUID() });
    if (!input.success) { setErro(input.error.issues[0]?.message ?? "Confira os dados."); return; }
    setOcupado(true); setErro("");
    try { const r = await conferirParticipantesContratuais(input.data); if (!r.ok) setErro(r.erro); else router.refresh(); }
    catch { setErro("Resultado não confirmado. Consulte o histórico ou reenvie os mesmos dados."); }
    finally { setOcupado(false); }
  }}>
    {dados.plano.pendencias.map((p) => <p key={p} role="status">{p}</p>)}
    <fieldset disabled={ocupado || incompleto} className="space-y-4"><legend className="font-medium">Conferência versão {dados.versaoEsperada + 1}</legend>
      {dados.maioridade && <section className="space-y-2 rounded border p-3"><h2>Fundamento da classificação de maioridade</h2>
        <label className="block">Critério aplicável conferido<textarea name="criterio" required minLength={5} maxLength={2000} className={campo} /></label>
        <label className="block">Documento conferido<select name="evidenciaMaioridade" required defaultValue="" className={campo}><option value="" disabled>Selecione</option>{dados.documentos.map((d) => <option key={d.id} value={d.id}>{d.nome} · {d.categoria}</option>)}</select></label>
      </section>}
      {dados.participantes.map((p) => <section key={p.papel} className="space-y-2 rounded border p-3"><h2 className="font-medium">{PAPEIS_MODELO[p.papel]} · {p.etapa === "CLIENTE" ? "primeira etapa" : "após assinaturas do cliente"}</h2>
        {p.automatico ? p.identidade ? <dl><dt>Nome</dt><dd>{p.identidade.nome}</dd><dt>E-mail</dt><dd>{p.identidade.email}</dd><dt>Documento</dt><dd>{p.identidade.documento}</dd></dl> : <p role="alert">Complete nome, documento e e-mail no cadastro ou no pagador desta matrícula antes de conferir.</p> : <>
          <label className="block">Nome da pessoa<input name={`${p.papel}_nome`} required maxLength={200} className={campo} /></label>
          <label className="block">E-mail individual<input name={`${p.papel}_email`} type="email" required maxLength={254} className={campo} /></label>
          <label className="block">Documento da pessoa<input name={`${p.papel}_documento`} required maxLength={100} className={campo} /></label>
          <label className="block">Representação conferida<textarea name={`${p.papel}_representacao`} required minLength={5} maxLength={2000} className={campo} /></label>
          <label className="block">Evidência da representação<select name={`${p.papel}_evidencia`} required defaultValue="" className={campo}><option value="" disabled>Selecione</option>{dados.documentos.map((d) => <option key={d.id} value={d.id}>{d.nome} · {d.categoria}</option>)}</select></label>
        </>}
      </section>)}
      <label className="block">Motivo da conferência<textarea name="motivo" required minLength={5} maxLength={2000} className={campo} /></label>
      <label className="block"><input name="conferido" type="checkbox" required /> Conferi as identidades, contatos e a representação aplicável a cada pessoa.</label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar conferência dos participantes"}</button>
    </fieldset>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}
