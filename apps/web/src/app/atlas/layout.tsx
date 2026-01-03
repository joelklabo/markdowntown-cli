import { AtlasHeader } from "@/components/atlas/AtlasHeader";
import { AtlasSidebar } from "@/components/atlas/AtlasSidebar";
import { Container } from "@/components/ui/Container";

export default function AtlasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-mdt-6 md:py-mdt-8">
      <Container size="xl" padding="md">
        <div className="grid gap-mdt-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-mdt-8">
          <aside className="h-fit lg:sticky lg:top-20">
            <AtlasSidebar />
          </aside>
          <div className="min-w-0">
            <AtlasHeader />
            <div className="pt-mdt-6">{children}</div>
          </div>
        </div>
      </Container>
    </div>
  );
}
