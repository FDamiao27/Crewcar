import { LegalPage, legalMetadata } from "@/components/site/legal-page";

export const generateMetadata = () => legalMetadata("privacidade");

export default function Page() {
  return <LegalPage slug="privacidade" />;
}
