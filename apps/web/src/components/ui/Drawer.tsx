import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn, focusRing, interactiveBase } from "@/lib/cn";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;

function DrawerOverlay(props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
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

export function DrawerContent({
  className,
  children,
  "aria-describedby": ariaDescribedBy,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        {...props}
        aria-describedby={ariaDescribedBy ?? undefined}
        className={cn(
          "mdt-radix-panel-slide-right",
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-mdt-border-strong bg-mdt-surface-raised shadow-[var(--mdt-shadow-md)]",
          className
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DrawerHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-mdt-3 border-b border-mdt-border px-mdt-5 py-mdt-4", className)}>
      {children}
    </div>
  );
}

export const DrawerTitle = DialogPrimitive.Title;
const DrawerClose = DialogPrimitive.Close;

export function DrawerCloseButton() {
  return (
    <DrawerClose
      className={cn(
        "rounded-mdt-md p-mdt-2 text-mdt-muted hover:bg-[color:var(--mdt-color-surface-strong)]",
        interactiveBase,
        focusRing
      )}
    >
      <span aria-hidden className="text-sm font-semibold leading-none">
        ×
      </span>
      <span className="sr-only">Close drawer</span>
    </DrawerClose>
  );
}
