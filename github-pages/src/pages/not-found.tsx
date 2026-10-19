import { NotFoundContent } from "@/components/site/not-found-content";
import { useMeta } from "../showroom";

export function NotFoundPage() {
  useMeta("Página não encontrada");
  return <NotFoundContent />;
}
