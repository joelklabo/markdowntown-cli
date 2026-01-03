import { Card } from "@/components/ui/Card";

type Props = {
  views: number;
  copies: number;
  votes?: number;
};

export function DetailStats({ views, copies, votes = 0 }: Props) {
  const items = [
    { label: "Views", value: views, icon: "👁️" },
    { label: "Copies", value: copies, icon: "📋" },
    { label: "Votes", value: votes, icon: "👍" },
  ];

  return (
    <div className="grid w-full gap-mdt-3 sm:grid-cols-3">
      {items.map((item) => (
        <Card
          key={item.label}
          tone="subtle"
          padding="sm"
          className="flex items-center justify-between gap-mdt-3 text-body-sm"
        >
          <div className="flex items-center gap-mdt-2 text-mdt-muted">
            <span aria-hidden className="text-body-sm">{item.icon}</span>
            <span className="text-caption">{item.label}</span>
          </div>
          <span className="font-semibold text-mdt-text">{item.value.toLocaleString()}</span>
        </Card>
      ))}
    </div>
  );
}
