import { validarCertificado } from "@/server/academico/consultas";

// VALIDAÇÃO PÚBLICA de certificado (Fase 3): terceiros conferem a autenticidade pelo
// código impresso no certificado. Projeção mínima (nome + nível + data de emissão).

export default async function CertificadoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const cert = await validarCertificado(codigo.toUpperCase());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-xl font-medium">Validação de certificado — Escola Genius</h1>
      {!cert ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Código inválido — este certificado não consta em nossos registros.
        </p>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-medium text-green-800">Certificado autêntico ✅</p>
          <dl className="mt-2 space-y-1 text-gray-700">
            <div><dt className="inline text-gray-500">Aluno: </dt><dd className="inline font-medium">{cert.aluno}</dd></div>
            <div><dt className="inline text-gray-500">Nível: </dt><dd className="inline">{cert.nivel}</dd></div>
            <div>
              <dt className="inline text-gray-500">Emitido em: </dt>
              <dd className="inline">{new Date(cert.emitidoEmISO).toLocaleDateString("pt-BR")}</dd>
            </div>
            <div><dt className="inline text-gray-500">Código: </dt><dd className="inline font-mono">{codigo.toUpperCase()}</dd></div>
          </dl>
        </div>
      )}
    </main>
  );
}
