import { createContext, useContext } from 'react';

export interface GroupNavigation {
  navigateToGroup: (groupId: number) => void;
}

// No-op default so isolated component tests render without a provider.
export const NavigationContext = createContext<GroupNavigation>({ navigateToGroup: () => {} });

export function useGroupNavigation(): GroupNavigation {
  return useContext(NavigationContext);
}
