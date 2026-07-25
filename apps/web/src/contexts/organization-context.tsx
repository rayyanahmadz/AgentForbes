import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";
import type { OrgRole, Organization } from "@/lib/supabase/types";

interface MyOrganization {
  organization: Organization;
  role: OrgRole;
}

interface OrganizationContextValue {
  organization: Organization | null;
  role: OrgRole | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  myOrganizations: MyOrganization[];
  switchOrganization: (organizationId: string) => Promise<void>;
  createOrganization: (name: string) => Promise<{ error: string | null }>;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { profile, refreshProfile } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrgRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myOrganizations, setMyOrganizations] = useState<MyOrganization[]>([]);

  const load = useCallback(async () => {
    if (!profile?.default_organization_id) {
      setOrganization(null);
      setRole(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const [
      { data: org, error: orgError },
      { data: membership, error: memberError },
      { data: allMemberships, error: allError }
    ] = await Promise.all([
      supabase
        .from("organizations")
        .select("*")
        .eq("id", profile.default_organization_id)
        .single(),
      supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", profile.default_organization_id)
        .eq("user_id", profile.id)
        .single(),
      supabase
        .from("organization_members")
        .select("role, organizations (*)")
        .eq("user_id", profile.id)
    ]);

    if (orgError) console.error("Failed to load organization:", orgError.message);
    if (memberError) console.error("Failed to load membership:", memberError.message);
    if (allError) console.error("Failed to load organization list:", allError.message);

    setOrganization(org ?? null);
    setRole(membership?.role ?? null);
    setMyOrganizations(
      (allMemberships ?? [])
        .map((row) => {
          const org = row.organizations as unknown as Organization | null;
          return org ? { organization: org, role: row.role } : null;
        })
        .filter((entry): entry is MyOrganization => entry !== null)
        .sort((a, b) => a.organization.name.localeCompare(b.organization.name))
    );
    setIsLoading(false);
  }, [profile?.id, profile?.default_organization_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      if (!profile) return;
      const { error } = await supabase
        .from("profiles")
        .update({ default_organization_id: organizationId })
        .eq("id", profile.id);

      if (error) {
        console.error("Failed to switch organization:", error.message);
        return;
      }

      await refreshProfile();
    },
    [profile, refreshProfile]
  );

  const createOrganization = useCallback(
    async (name: string): Promise<{ error: string | null }> => {
      const { data: newOrgId, error } = await supabase.rpc("create_organization", {
        org_name: name
      });

      if (error || !newOrgId) {
        return { error: error?.message ?? "Couldn't create the organization." };
      }

      await switchOrganization(newOrgId);
      return { error: null };
    },
    [switchOrganization]
  );

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organization,
      role,
      isLoading,
      refresh: load,
      myOrganizations,
      switchOrganization,
      createOrganization
    }),
    [organization, role, isLoading, load, myOrganizations, switchOrganization, createOrganization]
  );

  return (
    <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}
