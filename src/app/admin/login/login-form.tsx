"use client";

import { LogIn } from "lucide-react";
import { useActionState } from "react";
import { login, type LoginState } from "@/app/admin/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-5">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Input label="E-mail" name="email" type="email" autoComplete="username" required defaultValue={state.email} autoFocus />
      <Input label="Palavra-passe" name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" size="lg" className="w-full" loading={pending} icon={<LogIn className="size-4" />}>
        Entrar
      </Button>
    </form>
  );
}
