export const metadata = {
  title: "Área do aluno | Genius",
  robots: { index: false, follow: false },
};

/**
 * Esta árvore fica deliberadamente fora de `(app)`: não herda Sidebar nem o
 * guard NextAuth da equipe. Cada página protegida usa exigirSessaoPortalAluno.
 */
export default function LayoutPortalAluno({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-gray-50 text-gray-900">{children}</main>;
}
