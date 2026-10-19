"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { removeDemoVehicles } from "@/app/admin/actions/vehicles";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function RemoveDemoButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} icon={<Trash2 className="size-3.5" />}>
        Remover demonstração ({count})
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Remover viaturas de demonstração?"
        description={`Serão eliminadas ${count} viatura(s) marcadas como demonstração, incluindo fotografias e promoções. As suas viaturas reais não são afetadas.`}
        confirmLabel="Remover"
        onConfirm={async () => {
          const r = await removeDemoVehicles();
          setOpen(false);
          toast(r.ok ? (r.message ?? "Removidas.") : r.message, r.ok ? "success" : "error");
        }}
      />
    </>
  );
}
