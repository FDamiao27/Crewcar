"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-16">
      <Notice tone="danger" title="Não foi possível carregar esta página">
        Ocorreu um erro ao obter os dados. Verifique a ligação e tente novamente.
        {error.digest && <span className="mt-2 block text-xs text-metal">Código: {error.digest}</span>}
      </Notice>
      <Button className="mt-4" variant="secondary" onClick={reset} icon={<RotateCcw className="size-4" />}>
        Tentar novamente
      </Button>
    </div>
  );
}
