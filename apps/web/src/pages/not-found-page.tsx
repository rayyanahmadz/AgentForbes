import { Link } from "react-router-dom";
import { Button } from "@agentforge/ui";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <h1 className="text-4xl font-semibold">404</h1>
      <p className="text-muted-foreground">This page doesn&apos;t exist yet.</p>
      <Button asChild>
        <Link to="/">Back home</Link>
      </Button>
    </main>
  );
}
