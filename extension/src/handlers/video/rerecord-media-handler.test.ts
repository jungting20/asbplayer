import { expect, it, jest } from '@jest/globals';
import type { AnkiUiSavedState, RerecordMediaMessage, VideoToExtensionCommand } from '@project/common';
import type { SettingsProvider } from '@project/common/settings';
import type AudioRecorderService from '@project/extension/src/services/audio-recorder-service';
import type { CardPublisher } from '@project/extension/src/services/card-publisher';
import RerecordMediaHandler from '@project/extension/src/handlers/video/rerecord-media-handler';

const command = (returnAudio: boolean): VideoToExtensionCommand<RerecordMediaMessage> => ({
    sender: 'asbplayer-video',
    src: 'video-source',
    message: {
        command: 'rerecord-media',
        returnAudio,
        duration: 1500,
        timestamp: 1000,
        audioPaddingStart: 0,
        audioPaddingEnd: 0,
        playbackRate: 1,
        subtitleFileName: 'episode.srt',
        uiState: { timestampInterval: [1000, 2500] } as AnkiUiSavedState,
    },
});

it('returns recorded audio to a range editor without opening a second modal or publishing a card', async () => {
    const start = jest
        .fn<(time: number, encodeAsMp3: boolean, requester: { tabId: number; src: string }) => Promise<string>>()
        .mockResolvedValue('recorded-audio');
    const publish = jest.fn();
    const handler = new RerecordMediaHandler(
        {} as SettingsProvider,
        { startWithTimeout: start } as unknown as AudioRecorderService,
        { publish } as unknown as CardPublisher
    );
    const response = await new Promise<any>((resolve) => {
        expect(handler.handle(command(true), { tab: { id: 42 } } as Browser.runtime.MessageSender, resolve)).toBe(true);
    });
    expect(start).toHaveBeenCalledWith(1500, false, { tabId: 42, src: 'video-source' });
    expect(response.audio).toMatchObject({ base64: 'recorded-audio', start: 1000, end: 2500 });
    expect(publish).not.toHaveBeenCalled();
});

it('returns a recording failure so the range editor can retry', async () => {
    const start = jest
        .fn<(time: number, encodeAsMp3: boolean, requester: { tabId: number; src: string }) => Promise<string>>()
        .mockRejectedValue(new Error('Recording unavailable'));
    const handler = new RerecordMediaHandler(
        {} as SettingsProvider,
        { startWithTimeout: start } as unknown as AudioRecorderService,
        {} as CardPublisher
    );
    const response = await new Promise<any>((resolve) => {
        handler.handle(command(true), { tab: { id: 42 } } as Browser.runtime.MessageSender, resolve);
    });
    expect(response).toEqual({ error: 'Recording unavailable' });
});

it('keeps the normal modal flow when audio is not requested by a range editor', async () => {
    const start = jest.fn<() => Promise<string>>().mockResolvedValue('native-audio');
    const publish = jest.fn();
    const sendMessage = jest.fn();
    const originalBrowser = (globalThis as any).browser;
    (globalThis as any).browser = { tabs: { sendMessage } };
    try {
        const handler = new RerecordMediaHandler(
            {} as SettingsProvider,
            { startWithTimeout: start } as unknown as AudioRecorderService,
            { publish } as unknown as CardPublisher
        );
        await new Promise<void>((resolve) => {
            sendMessage.mockImplementation(() => {
                resolve();
                return Promise.resolve();
            });
            handler.handle(command(false), { tab: { id: 42 } } as Browser.runtime.MessageSender, () => undefined);
        });
        expect(publish).toHaveBeenCalledTimes(1);
        expect(sendMessage).toHaveBeenCalledWith(
            42,
            expect.objectContaining({
                message: expect.objectContaining({ command: 'show-anki-ui-after-rerecord' }),
            })
        );
    } finally {
        (globalThis as any).browser = originalBrowser;
    }
});
