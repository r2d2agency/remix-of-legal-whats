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
          
          // If there ARE access groups, strictly filter by those groups the user belongs to
          if (accessGroups && accessGroups.length > 0) {
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
          }

          // If NO access groups are created, we check for direct connection assignments (Hybrid Mode)
          // We fetch the member info for the current user
          try {
            const memberInfo = await api<any>(`/api/organizations/${user.organization_id}/members/${user.id}`);
            if (memberInfo && memberInfo.assigned_connections && memberInfo.assigned_connections.length > 0) {
              const assignedIds = new Set(memberInfo.assigned_connections.map((c: any) => c.id));
              return allConnections.filter(conn => assignedIds.has(conn.id));
            }
          } catch (e) {
            // If we can't get member info or it's not restricted, return all (standard behavior)
            return allConnections;
          }
        } catch (error) {
          console.error('[useConnections] Error fetching access groups:', error);
          return allConnections;
        }
      }

      return allConnections;
    },
    staleTime: 30000,
  });
}
