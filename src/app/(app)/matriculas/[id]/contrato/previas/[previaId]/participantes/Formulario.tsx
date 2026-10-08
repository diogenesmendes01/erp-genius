"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { conferirParticipantesContratuais, consultarFormularioParticipantes } from "@/server/contratos/participantes";
import { ConferirParticipantesSchema } from "@/server/contratos/participantes-schema";
import { PAPEIS_MODELO } from "@/app/(app)/configuracao/contratos/labels";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { CATEGORIA_DOCUMENTO_LABEL, rotular } from "@/lib/labels";
type Consulta = Awaited<ReturnType<typeof consultarFormularioParticipantes>>;
type Dados = NonNullable<Extract<Consulta, { ok: true }>["dado"]>;
type Participante = z.infer<typeof ConferirParticipantesSchema>["participantes"][number];

/** Valor digitado por nome de campo; nome que nunca foi digitado vale "" (sem herdar nada do protótipo). */
export const valorDigitado = (valores: Record<string, string>, nome: string) => Object.prototype.hasOwnProperty.call(valores, nome) ? valores[nome] : "";

export function FormularioParticipantes({ dados }: { dados: Dados }) {
  const router = useRouter(), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  // Tudo o que é digitado fica no estado, por nome de campo (docs/43 §6 item 3; docs/42 L629): a troca da
  // maioridade muda os papéis exigidos e pode tirar e devolver seções (critério, um signatário); com o valor
  // aqui, voltar a classificação devolve o que foi preenchido. O componente não tem key e não remonta.
  const [valores, setValores] = useState<Record<string, string>>({});
  // A chave de idempotência acompanha a entrada: dados novos (outra maioridade, outro texto) são outra tentativa.
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  const valor = (nome: string) => valorDigitado(valores, nome);
  const ligar = (nome: string) => ({ name: nome, value: valor(nome), onChange: (e: { target: { value: string } }) => setValores((v) => ({ ...v, [nome]: e.target.value })) });
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
    const semChave = { previaId: dados.previaId, versaoEsperada: dados.versaoEsperada,
      maioridade: dados.maioridade ? { classificacao: dados.maioridade, criterio: obter("criterio"), evidenciaDocumentoId: obter("evidenciaMaioridade") } : null,
      participantes, identificacoesConferidas: true as const, motivo: obter("motivo") };
    const entrada = JSON.stringify(semChave);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const input = ConferirParticipantesSchema.safeParse({ ...semChave, chaveIdempotencia: tentativa.current.chave });
    if (!input.success) { setErro(input.error.issues[0]?.message ?? "Confira os dados."); return; }
    setOcupado(true); setErro("");
    try {
      const r = await conferirParticipantesContratuais(input.data);
      if (!r.ok) setErro(r.erro);
      // Registrada: a próxima conferência começa limpa (é outra versão), como antes fazia a remontagem pela key.
      else { setValores({}); tentativa.current = null; router.refresh(); }
    }
    catch { setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); }
    finally { setOcupado(false); }
  }}>
    {dados.plano.pendencias.map((p) => <p key={p} role="status">{p}</p>)}
    <fieldset disabled={ocupado || incompleto} className="space-y-4"><legend className="font-medium">Conferência versão {dados.versaoEsperada + 1}</legend>
      {dados.maioridade && <section className="space-y-2 rounded border p-3"><h2>Fundamento da classificação de maioridade</h2>
        <label className="block">Critério aplicável conferido<CampoTexto {...ligar("criterio")} required minLength={5} maxLength={2000} className={campo} /></label>
        <label className="block">Documento conferido<select {...ligar("evidenciaMaioridade")} required className={campo}><option value="" disabled>Selecione</option>{dados.documentos.map((d) => <option key={d.id} value={d.id}>{d.nome} · {rotular(CATEGORIA_DOCUMENTO_LABEL, d.categoria)}</option>)}</select></label>
      </section>}
      {dados.participantes.map((p) => <section key={p.papel} className="space-y-2 rounded border p-3"><h2 className="font-medium">{PAPEIS_MODELO[p.papel]} · {p.etapa === "CLIENTE" ? "primeira etapa" : "após assinaturas do cliente"}</h2>
        {p.automatico ? p.identidade ? <dl><dt>Nome</dt><dd>{p.identidade.nome}</dd><dt>E-mail</dt><dd>{p.identidade.email}</dd><dt>Documento</dt><dd>{p.identidade.documento}</dd></dl> : <p role="alert">Complete nome, documento e e-mail no cadastro ou no pagador desta matrícula antes de conferir.</p> : <>
          <label className="block">Nome da pessoa<input {...ligar(`${p.papel}_nome`)} required maxLength={200} className={campo} /></label>
          <label className="block">E-mail individual<input {...ligar(`${p.papel}_email`)} type="email" required maxLength={254} className={campo} /></label>
          <label className="block">Documento da pessoa<input {...ligar(`${p.papel}_documento`)} required maxLength={100} className={campo} /></label>
          <label className="block">Representação conferida<CampoTexto {...ligar(`${p.papel}_representacao`)} required minLength={5} maxLength={2000} className={campo} /></label>
          <label className="block">Evidência da representação<select {...ligar(`${p.papel}_evidencia`)} required className={campo}><option value="" disabled>Selecione</option>{dados.documentos.map((d) => <option key={d.id} value={d.id}>{d.nome} · {rotular(CATEGORIA_DOCUMENTO_LABEL, d.categoria)}</option>)}</select></label>
        </>}
      </section>)}
      <label className="block">Motivo da conferência<CampoTexto {...ligar("motivo")} required minLength={5} maxLength={2000} className={campo} /></label>
      <label className="block"><input name="conferido" type="checkbox" required /> Conferi as identidades, contatos e a representação aplicável a cada pessoa.</label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar conferência dos participantes"}</button>
    </fieldset>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}
