import { AppShell } from './components/ui/AppShell';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DevStatusPanel } from './features/dev/DevStatusPanel';

function App() {
  return (
    <ErrorBoundary>
      <AppShell>
        <DevStatusPanel />
      </AppShell>
    </ErrorBoundary>
  );
}

export default App;
