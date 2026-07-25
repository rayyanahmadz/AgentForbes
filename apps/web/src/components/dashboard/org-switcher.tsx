import { useState, type FormEvent } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@agentforge/ui";

import { useOrganization } from "@/contexts/organization-context";

export function OrgSwitcher() {
  const { organization, myOrganizations, switchOrganization, createOrganization } =
    useOrganization();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(organizationId: string) {
    if (organizationId === organization?.id) {
      setIsOpen(false);
      return;
    }
    await switchOrganization(organizationId);
    setIsOpen(false);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newOrgName.trim()) return;

    setIsSaving(true);
    setError(null);
    const { error: createError } = await createOrganization(newOrgName.trim());
    setIsSaving(false);

    if (createError) {
      setError(createError);
      return;
    }

    setNewOrgName("");
    setIsCreating(false);
    setIsOpen(false);
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setIsCreating(false);
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-accent"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {organization?.name ?? "Loading…"}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {!isCreating ? (
          <>
            <ul className="flex flex-col gap-0.5">
              {myOrganizations.map(({ organization: org, role }) => (
                <li key={org.id}>
                  <button
                    type="button"
                    onClick={() => void handleSelect(org.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{org.name}</span>
                      <span className="text-xs capitalize text-muted-foreground">{role}</span>
                    </span>
                    {org.id === organization?.id && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1 border-t pt-1">
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                Create organization
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col gap-2 p-1.5">
            <Input
              autoFocus
              placeholder="Organization name"
              value={newOrgName}
              onChange={(event) => setNewOrgName(event.target.value)}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-1.5">
              <Button type="submit" size="sm" disabled={isSaving || !newOrgName.trim()}>
                {isSaving ? "Creating…" : "Create"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
