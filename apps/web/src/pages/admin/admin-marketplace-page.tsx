import { useCallback, useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { Button, Card, CardContent } from "@agentforge/ui";

import { getProviderOption } from "@/lib/ai-providers";
import { supabase } from "@/lib/supabase/client";
import type { MarketplaceListing } from "@/lib/supabase/types";
import type { AiProvider } from "@/lib/supabase/types";

export function AdminMarketplacePage() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    const { data, error: fetchError } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("is_published", true)
      .order("install_count", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError(null);
      setListings(data ?? []);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUnpublish(listing: MarketplaceListing) {
    const confirmed = window.confirm(
      `Unpublish "${listing.name}" by ${listing.publisher_name}? It will no longer appear in the marketplace. Copies already installed by other organizations keep working.`
    );

    if (!confirmed) return;

    setUnpublishingId(listing.id);

    const { error: rpcError } = await supabase.rpc("admin_unpublish_listing", {
      target_listing_id: listing.id
    });

    setUnpublishingId(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setListings((current) => current.filter((l) => l.id !== listing.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Marketplace moderation
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Every published listing on the platform, across all organizations.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No published listings.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {listing.name}
                    </p>

                    <p className="truncate text-xs text-muted-foreground">
                      by {listing.publisher_name} ·{" "}
                      {
                        getProviderOption(
                          listing.provider as AiProvider
                        ).label
                      }{" "}
                      · {listing.install_count.toLocaleString()} installs
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 text-destructive hover:text-destructive"
                    disabled={unpublishingId === listing.id}
                    onClick={() => void handleUnpublish(listing)}
                  >
                    <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {unpublishingId === listing.id
                      ? "Unpublishing…"
                      : "Unpublish"}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}