import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";

export function usePlatformAdmin() {
  const { user } = useAuth();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsPlatformAdmin(false);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    supabase.rpc("is_platform_admin").then(({ data }) => {
      if (!isMounted) return;
      setIsPlatformAdmin(Boolean(data));
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return { isPlatformAdmin, isLoading };
}
