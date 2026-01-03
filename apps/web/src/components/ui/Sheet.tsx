import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";

export type SheetSide = "top" | "bottom" | "right";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;

function SheetOverlay(props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      {...props}
      className={cn(
        "mdt-radix-overlay fixed inset-0 z-40 bg-[color:var(--mdt-color-overlay)] backdrop-blur-sm",
        props.className
      )}
    />
  );
}

const sideStyles: Record<
  SheetSide,
  { motion: string; panel: string }
> = {
  top: {
    motion: "mdt-radix-panel-slide",
    panel:
      "fixed inset-x-0 top-0 z-50 w-full max-h-[85vh] overflow-auto border-b border-mdt-border-strong bg-mdt-surface-raised shadow-[var(--mdt-shadow-md)]",
  },
  bottom: {
    motion: "mdt-radix-panel-slide",
    panel:
      "fixed inset-x-0 bottom-0 z-50 w-full max-h-[85vh] overflow-auto border-t border-mdt-border-strong bg-mdt-surface-raised shadow-[var(--mdt-shadow-md)]",
  },
  right: {
    motion: "mdt-radix-panel-slide-right",
    panel:
      "fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col overflow-auto border-l border-mdt-border-strong bg-mdt-surface-raised shadow-[var(--mdt-shadow-md)]",
  },
};

export function SheetContent({
  side = "right",
  className,
  children,
  "aria-describedby": ariaDescribedBy,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: SheetSide }) {
  const styles = sideStyles[side];
  const safeTop = side === "top" || side === "right";
  const safeBottom = side === "bottom" || side === "right";

  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        {...props}
        aria-describedby={ariaDescribedBy ?? undefined}
        className={cn(styles.motion, styles.panel, className)}
      >
        {safeTop && <div aria-hidden className="h-[env(safe-area-inset-top)]" />}
        {children}
        {safeBottom && <div aria-hidden className="h-[env(safe-area-inset-bottom)]" />}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
