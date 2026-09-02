import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { AcessoNegado } from "@/components/AcessoNegado";
import { dadosPortalDoUsuario } from "@/server/academico/consultas";

// PORTAL DO ALUNO (Fase 3, doc 03): projeção EXCLUSIVA dos próprios dados, resolvida
// pelo vínculo Aluno.usuarioId — nenhum id vem da URL, nada de dados de terceiros.

const STATUS_COBRANCA: Record<string, { rotulo: string; cls: string }> = {
  PAGO: { rotulo: "Paga", cls: "bg-green-100 text-green-700" },
  PENDENTE: { rotulo: "Em aberto", cls: "bg-amber-100 text-amber-700" },
  ATRASADO: { rotulo: "Atrasada", cls: "bg-red-100 text-red-700" },
};

export default async function PortalPage() {
  // Papel explícito no guard: só ALUNO (e Admin, que passa em tudo) entra aqui.
  const usuario = await exigirSessaoPagina(Papel.ALUNO);
  if (!usuario.papeis.includes(Papel.ALUNO) && !usuario.papeis.includes(Papel.ADMINISTRADOR)) {
    return <AcessoNegado recurso="o portal do aluno" />;
  }
  const dados = await dadosPortalDoUsuario(usuario);
  if (!dados) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
        Seu acesso ainda não está vinculado a um cadastro de aluno — fale com a secretaria.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-medium">Olá, {dados.aluno.nome.split(" ")[0]}!</h1>
        <p className="mt-1 text-sm text-gray-500">{dados.aluno.codigo ?? ""} · Portal do aluno</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-2 font-medium">Minha turma</h2>
          {dados.turma ? (
            <div className="text-sm text-gray-700">
              <div className="font-medium">{dados.turma.label}</div>
              <div className="text-gray-500">{dados.turma.diasHorario ?? "Horário a definir"}</div>
              <div className="text-gray-500">Professor: {dados.turma.professor ?? "—"}</div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Você ainda não está alocado em uma turma.</p>
          )}

          <h2 className="mb-2 mt-5 font-medium">Minha frequência</h2>
          {dados.frequencia.pct === null ? (
            <p className="text-sm text-gray-400">Nenhuma aula registrada ainda.</p>
          ) : (
            <p className="text-sm text-gray-700">
              <span className="text-2xl font-medium">{dados.frequencia.pct}%</span>{" "}
              <span className="text-gray-500">
                ({dados.frequencia.presentes} presença(s) em {dados.frequencia.total} aula(s))
              </span>
            </p>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-2 font-medium">Meu boletim</h2>
          {dados.boletim.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma avaliação ainda.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500">
                  <tr>
                    <th className="py-1 font-medium">Avaliação</th>
                    <th className="py-1 font-medium">Peso</th>
                    <th className="py-1 font-medium">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dados.boletim.map((b, i) => (
                    <tr key={i}>
                      <td className="py-1.5 text-gray-700">{b.avaliacao}</td>
                      <td className="py-1.5 text-gray-500">{b.peso}</td>
                      <td className="py-1.5 font-medium text-gray-800">{b.nota ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dados.media !== null && (
                <p className="mt-2 text-sm text-gray-700">
                  Média atual: <span className="text-lg font-medium">{dados.media}</span>
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-2 font-medium">Meu financeiro</h2>
        {dados.financeiro.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma cobrança.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500">
                <tr>
                  <th className="px-2 py-1 font-medium">Cobrança</th>
                  <th className="px-2 py-1 font-medium">Vencimento</th>
                  <th className="px-2 py-1 font-medium">Valor</th>
                  <th className="px-2 py-1 font-medium">Status</th>
                  <th className="px-2 py-1 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dados.financeiro.map((c) => {
                  const st = STATUS_COBRANCA[c.status] ?? { rotulo: c.status, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={c.id}>
                      <td className="px-2 py-1.5 text-gray-700">
                        {c.tipo}
                        {c.competencia ? ` · ${c.competencia}` : ""}
                      </td>
                      <td className="px-2 py-1.5 text-gray-500">{new Date(c.vencimentoISO).toLocaleDateString("pt-BR")}</td>
                      <td className="px-2 py-1.5 text-gray-700">
                        {c.moeda} {c.valor.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={"rounded-full px-2 py-0.5 text-xs " + st.cls}>{st.rotulo}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        {c.status !== "PAGO" && c.linkPagamento && (
                          <a
                            href={c.linkPagamento}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700"
                          >
                            Pagar
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-2 font-medium">Meus certificados</h2>
          {dados.certificados.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum certificado ainda — continue firme! 💪</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dados.certificados.map((c) => (
                <li key={c.codigoValidacao} className="rounded-md border border-gray-200 px-3 py-2">
                  <div className="font-medium text-gray-800">
                    {c.idioma} — nível {c.nivel} concluído
                  </div>
                  <div className="text-xs text-gray-500">
                    Emitido em {new Date(c.emitidoEmISO).toLocaleDateString("pt-BR")} · validação:{" "}
                    <a className="font-mono underline" href={`/certificado/${c.codigoValidacao}`} target="_blank" rel="noreferrer">
                      {c.codigoValidacao}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-2 font-medium">Testes de nível</h2>
          {dados.testesNivel.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum teste registrado.</p>
          ) : (
            <ul className="space-y-1 text-sm text-gray-700">
              {dados.testesNivel.map((t, i) => (
                <li key={i}>
                  Nível {t.nivel}
                  {t.pontuacao !== null ? ` · ${t.pontuacao} pts` : ""} ·{" "}
                  <span className="text-gray-400">{new Date(t.dataISO).toLocaleDateString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
