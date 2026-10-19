import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyledEngineProvider } from '@mui/material/styles';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import type { CardModel } from '@project/common';
import { HttpFetcher } from '@project/common';
import { Anki } from '@project/common/anki';
import { Mp3Encoder } from '@project/common/audio-clip';
import SubtitleRangeEditorsDialog from '@project/common/components/SubtitleRangeEditorsDialog';
import { DictionaryProvider } from '@project/common/dictionary-db';
import type { AsbplayerSettings } from '@project/common/settings';
import { SettingsProvider } from '@project/common/settings';
import { createTheme } from '@project/common/theme';
import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import { ExtensionDictionaryStorage } from '@project/extension/src/services/extension-dictionary-storage';
import { loadSubtitleRangeEditors } from '@project/extension/src/services/subtitle-range-editors';
import { mp3WorkerFactory } from '@project/extension/src/services/mp3-worker-factory';
import { useI18n } from '@project/extension/src/ui/hooks/use-i18n';

const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());
const dictionaryProvider = new DictionaryProvider(new ExtensionDictionaryStorage());

export default function SubtitleRangeEditorsUi() {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const [cards, setCards] = useState<CardModel[]>();
    const [failed, setFailed] = useState(false);
    const { initialized } = useI18n({ language: settings?.language ?? 'en' });
    const theme = useMemo(() => createTheme(settings?.themeType ?? 'dark'), [settings?.themeType]);
    const anki = useMemo(() => settings && new Anki(settings, new HttpFetcher()), [settings]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const id = new URLSearchParams(location.search).get('session');
            if (!id) throw new Error('Missing range editor session');
            const [settings, cards] = await Promise.all([settingsProvider.getAll(), loadSubtitleRangeEditors(id)]);
            if (!cards?.length) throw new Error('Range editor session is unavailable');
            if (!cancelled) {
                setSettings(settings);
                setCards(cards);
            }
        })().catch(() => {
            if (!cancelled) setFailed(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const encodeMp3 = useCallback(
        (blob: Blob, extension: string) =>
            extension === 'mp3' ? Promise.resolve(blob) : Mp3Encoder.encode(blob, mp3WorkerFactory),
        []
    );
    const copyToClipboard = useCallback((blob: Blob) => {
        void navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    }, []);

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {failed ? (
                    <Alert severity="error">{t('subtitleTimeFilter.editorsUnavailable')}</Alert>
                ) : initialized && settings && anki && cards ? (
                    <SubtitleRangeEditorsDialog
                        cards={cards}
                        anki={anki}
                        settings={settings}
                        mp3Encoder={encodeMp3}
                        onCopyToClipboard={copyToClipboard}
                        lastSelectedExportMode={settings.lastSelectedAnkiExportMode}
                        onClose={() => window.close()}
                        onExported={() => dictionaryProvider.ankiCardWasModified()}
                    />
                ) : (
                    <Box sx={{ display: 'grid', placeItems: 'center', height: '100dvh' }}>
                        <CircularProgress />
                    </Box>
                )}
            </ThemeProvider>
        </StyledEngineProvider>
    );
}
