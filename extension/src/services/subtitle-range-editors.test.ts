import { expect, it, jest } from '@jest/globals';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import {
    loadSubtitleRangeEditors,
    openSubtitleRangeEditors,
    removeSubtitleRangeEditorsForWindow,
} from '@project/extension/src/services/subtitle-range-editors';
import { subtitleTimeRangeCards } from '@project/common/app/components/subtitle-time-filter';

const cards = () =>
    subtitleTimeRangeCards(
        [],
        Array.from({ length: 7 }, (_, i) => ({
            start: i * 10000,
            end: i * 10000 + 5000,
        })),
        ['netflix.srt']
    );

it('opens a dedicated extension window with all seven unrecorded ranges and supports reloading', async () => {
    const storage = new MockStorageArea();
    const create = jest.fn<(url: string) => Promise<number | undefined>>().mockResolvedValue(42);
    await openSubtitleRangeEditors(cards(), storage, {
        url: () => 'chrome-extension://test/subtitle-range-editors.html',
        create,
    });
    expect(create).toHaveBeenCalledTimes(1);
    const url = new URL(create.mock.calls[0][0]);
    expect(url.pathname).toBe('/subtitle-range-editors.html');
    const id = url.searchParams.get('session')!;
    const loaded = await loadSubtitleRangeEditors(id, storage);
    expect(loaded).toHaveLength(7);
    expect(loaded?.map((card) => card.subtitle)).toEqual(cards().map((card) => card.subtitle));
    expect(loaded?.every((card) => card.audio === undefined)).toBe(true);
    expect(await loadSubtitleRangeEditors(id, storage)).toEqual(loaded);
});

it('removes a closed window session without touching other windows or unrelated session data', async () => {
    const storage = new MockStorageArea();
    await storage.set({ logs: ['keep'] });
    const urls: string[] = [];
    for (const windowId of [42, 43]) {
        await openSubtitleRangeEditors(cards(), storage, {
            url: () => 'chrome-extension://test/subtitle-range-editors.html',
            create: async (url) => {
                urls.push(url);
                return windowId;
            },
        });
    }
    await removeSubtitleRangeEditorsForWindow(42, storage);
    expect(await loadSubtitleRangeEditors(new URL(urls[0]).searchParams.get('session')!, storage)).toBeUndefined();
    expect(await loadSubtitleRangeEditors(new URL(urls[1]).searchParams.get('session')!, storage)).toHaveLength(7);
    expect((await storage.get('logs')).logs).toEqual(['keep']);
});

it('cleans up stored cards when opening a window fails', async () => {
    const storage = new MockStorageArea();
    await expect(
        openSubtitleRangeEditors(cards(), storage, {
            url: () => 'chrome-extension://test/subtitle-range-editors.html',
            create: async () => {
                throw new Error('window failed');
            },
        })
    ).rejects.toThrow('window failed');
    expect(await storage.get(null)).toEqual({});
});

it('stores only nearby context and retains subtitle file names and the Netflix URL', async () => {
    const storage = new MockStorageArea();
    const card = { ...cards()[0], subtitleFileName: 'netflix.srt', url: 'https://www.netflix.com/watch/123' };
    const distantSubtitle = { ...card.subtitle, start: 600000, end: 601000, text: 'distant' };
    card.surroundingSubtitles.push(distantSubtitle);
    let openedUrl = '';
    await openSubtitleRangeEditors([card], storage, {
        url: () => 'chrome-extension://test/subtitle-range-editors.html',
        create: async (url) => {
            openedUrl = url;
            return 42;
        },
    });
    const loaded = (await loadSubtitleRangeEditors(new URL(openedUrl).searchParams.get('session')!, storage))!;
    expect(loaded[0].surroundingSubtitles).not.toContainEqual(distantSubtitle);
    expect(loaded[0]).toMatchObject({ subtitleFileName: 'netflix.srt', url: 'https://www.netflix.com/watch/123' });
});
