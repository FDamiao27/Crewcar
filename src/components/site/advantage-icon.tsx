import { BadgeCheck, Clock, FileText, Handshake, KeyRound, ShieldCheck, Star, Wrench } from "lucide-react";
import type { Content } from "@/lib/site-schema";

const ICONS = {
  shield: ShieldCheck,
  check: BadgeCheck,
  key: KeyRound,
  wrench: Wrench,
  handshake: Handshake,
  file: FileText,
  star: Star,
  clock: Clock,
} as const;

export function AdvantageIcon({ name, className }: { name: Content["advantages"]["items"][number]["icon"]; className?: string }) {
  const Icon = ICONS[name] ?? BadgeCheck;
  return <Icon className={className} strokeWidth={1.4} aria-hidden="true" />;
}
