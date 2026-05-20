import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface Connection {
  id: string;
  name: string;
  phone_number: string | null;
  status: string;
  provider?: string;
  instance_id?: string;
}

interface AccessGroup {
  id: string;
  user_ids: string[];
  connection_ids: string[];
}

export function useConnections(options: { scope?: 'organization' | 'user' } = { scope: 'organization' }) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["connections", options.scope, user?.id],
    queryFn: async () => {
      const endpoint = options.scope === 'organization' 
        ? "/api/connections?scope=organization" 
        : "/api/connections";
      
      const allConnections = await api<Connection[]>(endpoint);
      
      // If user is owner or admin, they see everything
      if (user?.role === 'owner' || user?.role === 'admin') {
        return allConnections;
      }

      // Check if there are access groups defined for this organization
      if (user?.organization_id) {
        try {
          const accessGroups = await api<AccessGroup[]>(`/api/organizations/${user.organization_id}/access-groups`);
          
          // If NO access groups are created, we are in "Hybrid Mode" - show everything or fallback to existing behavior
          if (!accessGroups || accessGroups.length === 0) {
            return allConnections;
          }

          // If there ARE access groups, strictly filter by those groups the user belongs to
          const userGroups = accessGroups.filter(group => 
            group.user_ids && group.user_ids.includes(user.id)
          );
          
          const allowedConnectionIds = new Set<string>();
          userGroups.forEach(group => {
            if (group.connection_ids) {
              group.connection_ids.forEach(id => allowedConnectionIds.add(id));
            }
          });

          return allConnections.filter(conn => allowedConnectionIds.has(conn.id));
        } catch (error) {
          console.error('[useConnections] Error fetching access groups:', error);
          // On error, fallback to returning all (safer for "hybrid mode")
          return allConnections;
        }
      }

      return allConnections;
    },
    staleTime: 30000,
  });
}
