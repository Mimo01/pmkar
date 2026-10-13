import { createContext, useContext } from 'react';

export interface GroupNavigation {
  /**
   * Switch to a group's tab. `focusTab` moves focus onto the tab (keyboard
   * activation); pointer clicks pass false so the tab's tooltip does not open
   * on programmatic focus away from the cursor. Defaults to true.
   */
  navigateToGroup: (groupId: number, options?: { focusTab?: boolean }) => void;
}

// No-op default so isolated component tests render without a provider.
export const NavigationContext = createContext<GroupNavigation>({ navigateToGroup: () => {} });

export function useGroupNavigation(): GroupNavigation {
  return useContext(NavigationContext);
}
