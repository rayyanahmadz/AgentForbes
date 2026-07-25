import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Plus, Store, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Input } from "@agentforge/ui";

import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { getProviderOption } from "@/lib/ai-providers";
import { supabase } from "@/lib/supabase/client";
import type {
  MarketplaceListing,
  AiProvider
} from "@/lib/supabase/types";
export function MarketplaceListPage() {
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    if (!organization) return;

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
      setMyListings((data ?? []).filter((l) => l.organization_id === organization.id));
    }
    setIsLoading(false);
  }, [organization]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  async function handleInstall(listing: MarketplaceListing) {
    if (!organization || !user) return;

    setInstallingId(listing.id);
    setError(null);

    const { error: insertError } = await supabase.from("ai_employees").insert({
      organization_id: organization.id,
      created_by: user.id,
      name: listing.name,
      description: listing.description,
      instructions: listing.instructions,
      provider: listing.provider,
      model: listing.model,
      temperature: listing.temperature,
      is_active: true
    });

    if (insertError) {
      setInstallingId(null);
      setError(insertError.message);
      return;
    }

    await supabase.rpc("increment_marketplace_install_count", {
      target_listing_id: listing.id
    });

    setInstallingId(null);
    setInstalledIds((current) => new Set(current).add(listing.id));
    setListings((current) =>
      current.map((l) => (l.id === listing.id ? { ...l, install_count: l.install_count + 1 } : l))
    );
  }

  async function handleDelete(listing: MarketplaceListing) {
    const confirmed = window.confirm(
      `Remove "${listing.name}" from the marketplace? Copies already installed by other organizations keep working — this only removes the listing.`
    );
    if (!confirmed) return;

    setDeletingId(listing.id);
    const { error: deleteError } = await supabase
      .from("marketplace_listings")
      .delete()
      .eq("id", listing.id);
    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setListings((current) => current.filter((l) => l.id !== listing.id));
    setMyListings((current) => current.filter((l) => l.id !== listing.id));
  }

  const filteredListings = listings.filter((listing) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      listing.name.toLowerCase().includes(query) ||
      listing.description?.toLowerCase().includes(query) ||
      listing.publisher_name.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Install AI Employee templates published by other organizations, or
            publish your own.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/marketplace/publish">
            <Plus className="h-4 w-4" strokeWidth={2} />
            Publish an employee
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {myListings.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Published by your organization
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {myListings.map((listing) => (
              <Card key={listing.id}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{listing.name}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={deletingId === listing.id}
                      onClick={() => void handleDelete(listing)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {listing.install_count} {listing.install_count === 1 ? "install" : "installs"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Browse all</h2>
          <Input
            placeholder="Search…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-xs"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading listings…</p>
        ) : filteredListings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Store className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
              <p className="font-medium">
                {listings.length === 0 ? "No listings yet" : "No matches"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {listings.length === 0
                  ? "Be the first to publish an AI Employee template."
                  : "Try a different search."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredListings.map((listing) => {
const providerOption = getProviderOption(
  listing.provider as AiProvider
);              const isMine = listing.organization_id === organization?.id;
              const justInstalled = installedIds.has(listing.id);

              return (
                <Card key={listing.id}>
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{listing.name}</p>
                        {isMine && (
                          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                            Yours
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        by {listing.publisher_name} · {providerOption.label}
                      </p>
                    </div>

                    {listing.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {listing.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {listing.install_count}{" "}
                        {listing.install_count === 1 ? "install" : "installs"}
                      </p>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={installingId === listing.id}
                        onClick={() => void handleInstall(listing)}
                      >
                        <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {installingId === listing.id
                          ? "Installing…"
                          : justInstalled
                            ? "Installed ✓"
                            : "Install"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
