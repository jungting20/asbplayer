import { createRoot } from 'react-dom/client';
import SubtitleRangeEditorsUi from '@project/extension/src/ui/components/SubtitleRangeEditorsUi';
import { configureExtensionLogProvider } from '@project/extension/src/services/extension-log-provider';

configureExtensionLogProvider();
createRoot(document.getElementById('root')!).render(<SubtitleRangeEditorsUi />);
