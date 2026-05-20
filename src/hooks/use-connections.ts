import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Connection {
  id: string;
  name: string;
  phone_number: string | null;
  status: string;
  provider?: string;
  instance_id?: string;
}

export function useConnections(options: { scope?: 'organization' | 'user' } = { scope: 'organization' }) {
  return useQuery({
    queryKey: ["connections", options.scope],
    queryFn: async () => {
      const endpoint = options.scope === 'organization' 
        ? "/api/connections?scope=organization" 
        : "/api/connections";
      return api<Connection[]>(endpoint);
    },
    staleTime: 30000,
  });
}
