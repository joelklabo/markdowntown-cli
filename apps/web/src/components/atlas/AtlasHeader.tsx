import { AtlasSearch } from "@/components/atlas/AtlasSearch";
import { LastUpdatedBadge } from "@/components/atlas/LastUpdatedBadge";

export function AtlasHeader() {
  return (
    <header className="border-b border-mdt-border pb-mdt-5">
      <div className="flex flex-col gap-mdt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-mdt-3">
          <div className="text-h3 font-display text-mdt-text">Atlas</div>
          <LastUpdatedBadge />
        </div>

        <div className="relative w-full lg:max-w-[420px]">
          <AtlasSearch className="w-full" />
        </div>
      </div>
    </header>
  );
}
