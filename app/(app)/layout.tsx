import { Sidebar } from "@/components/sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
