import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useGame } from "@/game/useGame";
import { LabLoader } from "@/components/LabLoader";

export function RequireAccount({ children }: { children: ReactNode }) {
  const { accountId, learner, busy } = useGame();
  const navigate = useNavigate();
  useEffect(() => {
    if (!accountId && !busy) navigate({ to: "/" });
  }, [accountId, busy, navigate]);
  // No account yet: either redirecting (busy false) or the session is still
  // being restored on the client (busy true) — render nothing meanwhile.
  if (!accountId) return null;
  // Signed in but the learner data has not arrived from the chain yet.
  if (!learner) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy">
        <LabLoader label="Loading your lab" />
      </div>
    );
  }
  return <>{children}</>;
}
