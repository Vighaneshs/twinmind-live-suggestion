import { useEffect } from 'react';
import Header from './components/Header';
import TranscriptColumn from './components/TranscriptColumn';
import SuggestionsColumn from './components/SuggestionsColumn';
import ChatColumn from './components/ChatColumn';
import SettingsModal from './components/SettingsModal';
import Toasts from './components/Toasts';
import { useSession } from './store/session';

export default function App() {
  const hasKey = useSession((s) => Boolean(s.settings.apiKey));
  const setSettingsOpen = useSession((s) => s.setSettingsOpen);

  useEffect(() => {
    if (!hasKey) setSettingsOpen(true);
  }, [hasKey, setSettingsOpen]);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-3">
        <TranscriptColumn />
        <SuggestionsColumn />
        <ChatColumn />
      </main>
      <SettingsModal />
      <Toasts />
    </div>
  );
}
