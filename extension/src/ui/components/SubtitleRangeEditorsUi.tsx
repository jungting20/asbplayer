import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyledEngineProvider } from '@mui/material/styles';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import type {
    AudioModel,
    AnkiUiSavedState,
    CardModel,
    ExtensionToVideoCommand,
    RerecordSubtitleRangeMessage,
} from '@project/common';
import { HttpFetcher } from '@project/common';
import { Anki } from '@project/common/anki';
import { Mp3Encoder } from '@project/common/audio-clip';
import SubtitleRangeEditorsDialog from '@project/common/components/SubtitleRangeEditorsDialog';
import type { AnkiDialogState } from '@project/common/components/AnkiDialog';
import { DictionaryProvider } from '@project/common/dictionary-db';
import type { AsbplayerSettings } from '@project/common/settings';
import { SettingsProvider } from '@project/common/settings';
import { createTheme } from '@project/common/theme';
import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import { ExtensionDictionaryStorage } from '@project/extension/src/services/extension-dictionary-storage';
import { loadSubtitleRangeEditorSession } from '@project/extension/src/services/subtitle-range-editors';
import type { EditorSession } from '@project/extension/src/services/subtitle-range-editors';
import { mp3WorkerFactory } from '@project/extension/src/services/mp3-worker-factory';
import { useI18n } from '@project/extension/src/ui/hooks/use-i18n';

const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());
const dictionaryProvider = new DictionaryProvider(new ExtensionDictionaryStorage());

export default function SubtitleRangeEditorsUi() {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const [cards, setCards] = useState<CardModel[]>();
    const [video, setVideo] = useState<EditorSession['video']>();
    const [failed, setFailed] = useState(false);
    const { initialized } = useI18n({ language: settings?.language ?? 'en' });
    const theme = useMemo(() => createTheme(settings?.themeType ?? 'dark'), [settings?.themeType]);
    const anki = useMemo(() => settings && new Anki(settings, new HttpFetcher()), [settings]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const id = new URLSearchParams(location.search).get('session');
            if (!id) throw new Error('Missing range editor session');
            const [settings, session] = await Promise.all([
                settingsProvider.getAll(),
                loadSubtitleRangeEditorSession(id),
            ]);
            const cards = session?.cards;
            if (!cards?.length) throw new Error('Range editor session is unavailable');
            if (!cancelled) {
                setSettings(settings);
                setCards(cards);
                setVideo(session?.video);
            }
        })().catch(() => {
            if (!cancelled) setFailed(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const record = useCallback(
        async (card: CardModel, state: AnkiDialogState): Promise<AudioModel> => {
            if (!video) throw new Error('The source video is unavailable');
            const interval = state.timestampInterval ?? [card.subtitle.start, card.subtitle.end];
            const uiState: AnkiUiSavedState = {
                ...state,
                audio: card.audio,
                image: card.image,
                timestampInterval: interval,
                initialTimestampInterval: state.initialTimestampInterval ?? interval,
                lastAppliedTimestampIntervalToText: state.lastAppliedTimestampIntervalToText ?? interval,
                dialogRequestedTimestamp: card.mediaTimestamp,
            };
            const command: ExtensionToVideoCommand<RerecordSubtitleRangeMessage> = {
                sender: 'asbplayer-extension-to-video',
                src: video.src,
                message: { command: 'rerecord-subtitle-range', uiState },
            };
            const response = await browser.tabs.sendMessage(video.id, command);
            if (response?.error || !response?.audio)
                throw new Error(response?.error ?? 'Recording did not return audio');
            return response.audio;
        },
        [video]
    );

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
                        onRecord={video ? record : undefined}
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
