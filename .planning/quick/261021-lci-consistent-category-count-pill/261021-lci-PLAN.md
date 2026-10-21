# Quick 261021-lci: Consistent count pills on main category tabs

Watched was the only core tab (New / Not mine / Linked / Watched) with a count pill. Decision: remove it (none), since counting the other tabs would duplicate each page's filter/scope logic. Group chips keep their counts.

- Remove `useCoreTabCounts`, `tabCounts` prop on AppShell, App wiring, `nav.tabAria*` i18n keys
- Update tests (AppShell.navKeys, triageConsistency)
