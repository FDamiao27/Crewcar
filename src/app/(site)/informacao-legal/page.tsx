import { LegalPage, legalMetadata } from "@/components/site/legal-page";

export const generateMetadata = () => legalMetadata("informacao-legal");

export default function Page() {
  return <LegalPage slug="informacao-legal" />;
}
