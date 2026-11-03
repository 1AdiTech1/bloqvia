import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useGame } from "@/game/useGame";

export function RequireAccount({ children }: { children: ReactNode }) {
  const { accountId } = useGame();
  const navigate = useNavigate();
  useEffect(() => {
    if (!accountId) navigate({ to: "/" });
  }, [accountId, navigate]);
  if (!accountId) return null;
  return <>{children}</>;
}
