export const metadata = {
  title: { absolute: "Área do aluno | Genius" },
  robots: { index: false, follow: false },
};

export default function LayoutPortalAluno({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-gray-50 text-gray-900">{children}</main>;
}
