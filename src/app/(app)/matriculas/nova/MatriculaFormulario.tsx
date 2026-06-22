"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormaPagamento, TipoCobranca, OrigemNivel, Genero } from "@prisma/client";
import { FORMA_PAGAMENTO_LABEL } from "@/lib/labels";

const GENERO_LABEL: Record<Genero, string> = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  OUTRO: "Outro",
  NAO_INFORMADO: "Não informado",
};
import { criarMatricula, ativarMatricula } from "@/server/matricula/acoes";
import { solicitarAberturaTurma } from "@/server/turmas/acoes";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export interface PrecoRef {
  paisId: string;
  produtoId: string;
  tipoCobranca: TipoCobranca;
  valor: number;
}

export function MatriculaFormulario({
  lead,
  paises,
  produtos,
  turmas,
  niveis,
  precos,
}: {
  lead: { id: string; nome: string; telefoneE164: string | null; paisId: string | null } | null;
  paises: { id: string; nome: string; moedaLocal: string }[];
  produtos: { id: string; label: string }[];
  turmas: { id: string; label: string }[];
  niveis: { id: string; label: string }[];
  precos: PrecoRef[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aberturaMsg, setAberturaMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function pedirAbertura() {
    setAberturaMsg(null);
    const r = await solicitarAberturaTurma({ produtoId, nivelId: nivelInicialId || undefined });
    setAberturaMsg(r.ok ? "Solicitação enviada ao Gerente Pedagógico." : r.erro);
  }

  const [alunoNome, setNome] = useState(lead?.nome ?? "");
  const [alunoPaisId, setPaisId] = useState(lead?.paisId ?? paises[0]?.id ?? "");
  const [alunoDocumento, setDoc] = useState("");
  const [alunoTelefone, setTel] = useState(lead?.telefoneE164 ?? "");
  const [alunoEmail, setEmail] = useState("");
  const [alunoGenero, setGenero] = useState<Genero | "">("");
  const [alunoNascimento, setNasc] = useState("");
  // responsável financeiro (pagador)
  const [pagador, setPagador] = useState<"ALUNO" | "RESPONSAVEL" | "EMPRESA">("ALUNO");
  const [respNome, setRespNome] = useState("");
  const [respParentesco, setRespParentesco] = useState("");
  const [respTelefone, setRespTelefone] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [produtoId, setProduto] = useState(produtos[0]?.id ?? "");
  const [turmaId, setTurma] = useState("");
  const [nivelInicialId, setNivel] = useState("");
  const [origemNivel, setOrigem] = useState<OrigemNivel>(OrigemNivel.MANUAL);
  const [dataAvaliacaoNivel, setDataAval] = useState("");
  const [diaVencimento, setDia] = useState(5);
  const [taxaValor, setTaxa] = useState("");
  const [mensalidadeValor, setMens] = useState("");
  const [certificadoValor, setCert] = useState("");
  const [mesesPlano, setMeses] = useState(12);
  const [comissaoPct, setPct] = useState(20);

  const moeda = paises.find((p) => p.id === alunoPaisId)?.moedaLocal ?? "";

  function prefillPrecos(pid: string, prodId: string) {
    const taxa = precos.find(
      (p) => p.paisId === pid && p.produtoId === prodId && p.tipoCobranca === TipoCobranca.MATRICULA,
    );
    const mens = precos.find(
      (p) => p.paisId === pid && p.produtoId === prodId && p.tipoCobranca === TipoCobranca.MENSALIDADE,
    );
    if (taxa) setTaxa(String(taxa.valor));
    if (mens) setMens(String(mens.valor));
  }

  function montarInput() {
    return {
      leadId: lead?.id,
      alunoNome,
      alunoPaisId,
      alunoDocumento,
      alunoTelefone,
      alunoEmail,
      alunoGenero: alunoGenero || undefined,
      alunoNascimento,
      pagador,
      responsavelNome: respNome,
      responsavelParentesco: respParentesco,
      responsavelTelefone: respTelefone,
      responsavelEmail: respEmail,
      produtoId,
      turmaId: turmaId || undefined,
      nivelInicialId: nivelInicialId || undefined,
      origemNivel,
      dataAvaliacaoNivel,
      diaVencimento,
      taxaValor: taxaValor === "" ? 0 : Number(taxaValor),
      mensalidadeValor: mensalidadeValor === "" ? 0 : Number(mensalidadeValor),
      certificadoValor: certificadoValor === "" ? 0 : Number(certificadoValor),
      mesesPlano,
      comissaoPct,
    };
  }

  async function salvar(ativar: boolean) {
    setErro(null);
    setSalvando(true);
    const res = await criarMatricula(montarInput());
    if (!res.ok) {
      setErro(res.erro);
      setSalvando(false);
      return;
    }
    if (ativar && res.dado) {
      const at = await ativarMatricula(res.dado.id, { forma: FormaPagamento.TRANSFERENCIA });
      if (!at.ok) {
        setErro("Matrícula salva, mas ativação falhou: " + at.erro);
        setSalvando(false);
        router.push(lead ? `/leads/${lead.id}` : "/alunos");
        return;
      }
    }
    router.push(lead ? `/leads/${lead.id}` : "/alunos");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium">Nova matrícula</h1>
      {lead && (
        <p className="-mt-4 text-sm text-gray-500">
          Convertendo o lead <strong>{lead.nome}</strong> — confirme e complete os dados.
        </p>
      )}
      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {/* Aluno */}
      <section className="rounded-lg border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-medium">Aluno</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Nome</label>
            <input className={inputCls} value={alunoNome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">País</label>
            <select
              className={inputCls}
              value={alunoPaisId}
              onChange={(e) => {
                setPaisId(e.target.value);
                prefillPrecos(e.target.value, produtoId);
              }}
            >
              {paises.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Documento</label>
            <input className={inputCls} value={alunoDocumento} onChange={(e) => setDoc(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Telefone</label>
            <input className={inputCls} value={alunoTelefone} onChange={(e) => setTel(e.target.value)} placeholder="+506..." />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Nascimento</label>
            <input type="date" className={inputCls} value={alunoNascimento} onChange={(e) => setNasc(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">E-mail</label>
            <input type="email" className={inputCls} value={alunoEmail} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Gênero</label>
            <select className={inputCls} value={alunoGenero} onChange={(e) => setGenero(e.target.value as Genero | "")}>
              <option value="">—</option>
              {Object.values(Genero).map((g) => (
                <option key={g} value={g}>{GENERO_LABEL[g]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <label className="mb-1 block text-xs text-gray-600">Responsável financeiro (pagador)</label>
          <select className={inputCls + " mb-2 md:w-1/3"} value={pagador} onChange={(e) => setPagador(e.target.value as typeof pagador)}>
            <option value="ALUNO">O próprio aluno (Adulto)</option>
            <option value="RESPONSAVEL">Responsável (Kids/Teens)</option>
            <option value="EMPRESA">Empresa (B2B)</option>
          </select>
          {pagador !== "ALUNO" && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <input className={inputCls} placeholder={pagador === "EMPRESA" ? "Nome da empresa" : "Nome do responsável"} value={respNome} onChange={(e) => setRespNome(e.target.value)} />
              {pagador === "RESPONSAVEL" && (
                <input className={inputCls} placeholder="Parentesco" value={respParentesco} onChange={(e) => setRespParentesco(e.target.value)} />
              )}
              <input className={inputCls} placeholder="Telefone" value={respTelefone} onChange={(e) => setRespTelefone(e.target.value)} />
              <input className={inputCls} placeholder="E-mail" value={respEmail} onChange={(e) => setRespEmail(e.target.value)} />
            </div>
          )}
        </div>
      </section>

      {/* Curso & alocação */}
      <section className="rounded-lg border border-gray-200 bg-surface p-5">
        <h2 className="mb-4 text-sm font-medium">Curso & alocação</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Produto</label>
            <select
              className={inputCls}
              value={produtoId}
              onChange={(e) => {
                setProduto(e.target.value);
                prefillPrecos(alunoPaisId, e.target.value);
              }}
            >
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Turma (Aberta com vaga)</label>
            <select className={inputCls} value={turmaId} onChange={(e) => setTurma(e.target.value)}>
              <option value="">Sem alocação / lista de espera</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {!turmaId && (
              <button type="button" onClick={pedirAbertura} className="mt-1 text-xs text-brand-700 hover:underline">
                Sem turma compatível? Solicitar abertura ao Gerente Pedagógico
              </button>
            )}
            {aberturaMsg && <p className="mt-1 text-xs text-gray-500">{aberturaMsg}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Nível inicial</label>
            <select className={inputCls} value={nivelInicialId} onChange={(e) => setNivel(e.target.value)}>
              <option value="">—</option>
              {niveis.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Origem do nível</label>
            <select className={inputCls} value={origemNivel} onChange={(e) => setOrigem(e.target.value as OrigemNivel)}>
              <option value={OrigemNivel.MANUAL}>Manual</option>
              <option value={OrigemNivel.AVALIACAO}>Avaliação</option>
            </select>
          </div>
          {origemNivel === OrigemNivel.AVALIACAO && (
            <div>
              <label className="mb-1 block text-xs text-gray-600">Data da avaliação</label>
              <input type="date" className={inputCls} value={dataAvaliacaoNivel} onChange={(e) => setDataAval(e.target.value)} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-gray-600">Dia de vencimento</label>
            <select className={inputCls} value={diaVencimento} onChange={(e) => setDia(Number(e.target.value))}>
              {[5, 10, 15, 20, 25].map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Contrato */}
      <section className="rounded-lg border border-gray-200 bg-surface p-5">
        <h2 className="mb-1 text-sm font-medium">Contrato — linhas de cobrança</h2>
        <p className="mb-4 text-xs text-gray-400">Moeda: {moeda || "—"} · valores de referência pré-preenchidos (edite o negociado).</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Taxa de matrícula</label>
            <input type="number" step="0.01" className={inputCls} value={taxaValor} onChange={(e) => setTaxa(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Mensalidade</label>
            <input type="number" step="0.01" className={inputCls} value={mensalidadeValor} onChange={(e) => setMens(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Meses do plano</label>
            <input type="number" className={inputCls} value={mesesPlano} onChange={(e) => setMeses(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Comissão (% da taxa)</label>
            <input type="number" className={inputCls} value={comissaoPct} onChange={(e) => setPct(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Certificado (só Costa Rica)</label>
            <input type="number" step="0.01" className={inputCls} value={certificadoValor} onChange={(e) => setCert(e.target.value)} placeholder="0" />
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Primeiro pagamento: <strong>{moeda} {(Number(taxaValor || 0) + Number(mensalidadeValor || 0)).toLocaleString("pt-BR")}</strong> (taxa + 1ª mensalidade).
        </p>
      </section>

      <div className="flex gap-2">
        <button
          onClick={() => salvar(false)}
          disabled={salvando}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Salvar matrícula
        </button>
        <button
          onClick={() => salvar(true)}
          disabled={salvando}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {salvando ? "Processando…" : "Receber pagamento e ativar"}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        "Receber pagamento e ativar" marca taxa + 1ª mensalidade como pagas e ativa a matrícula
        (exige perfil Financeiro/Secretaria; {FORMA_PAGAMENTO_LABEL.TRANSFERENCIA} por padrão).
      </p>
    </div>
  );
}
