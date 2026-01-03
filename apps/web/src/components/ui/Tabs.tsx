import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn, focusRing, interactiveBase } from "@/lib/cn";

const triggerBase = cn(
  "inline-flex min-h-[var(--mdt-space-11)] items-center justify-center gap-mdt-2 rounded-mdt-md px-mdt-4 py-mdt-2 text-body-sm font-medium border-b-2 border-transparent whitespace-nowrap",
  "text-[color:var(--mdt-color-text-muted)] hover:text-[color:var(--mdt-color-text)] hover:border-[color:var(--mdt-color-border-strong)]",
  "data-[state=active]:text-[color:var(--mdt-color-text)] data-[state=active]:border-[color:var(--mdt-color-primary)]",
  interactiveBase,
  focusRing
);

export const TabsRoot = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex max-w-full items-center gap-mdt-2 overflow-x-auto border-b border-mdt-border px-mdt-1 pb-mdt-1",
        className
      )}
      {...props}
    />
  );
}

type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>;

export function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger className={cn(triggerBase, className)} {...props} />
  );
}

export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-mdt-4 rounded-mdt-lg border border-mdt-border bg-mdt-surface p-mdt-4 shadow-mdt-sm", className)}
      {...props}
    />
  );
}
