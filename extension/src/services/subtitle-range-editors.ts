import type { CardModel } from '@project/common';
import type { StorageArea } from '@project/extension/src/services/extension-settings-storage';
import { v4 as uuidv4 } from 'uuid';

const sessionPrefix = 'subtitle-range-editors:';
type SessionStorage = Pick<StorageArea, 'get' | 'set' | 'remove'>;
interface EditorSession {
    cards: CardModel[];
    windowId?: number;
}

interface PopupApi {
    url: () => string;
    create: (url: string) => Promise<number | undefined>;
}

const popupApi: PopupApi = {
    url: () => browser.runtime.getURL('/subtitle-range-editors.html'),
    create: async (url) =>
        (
            await browser.windows.create({
                type: 'popup',
                focused: true,
                width: 1600,
                height: 1000,
                url,
            })
        )?.id,
};

export const openSubtitleRangeEditors = async (
    cards: CardModel[],
    storage: SessionStorage = browser.storage.session,
    popup: PopupApi = popupApi
): Promise<void> => {
    if (!cards.length) return;
    const id = uuidv4();
    const key = sessionPrefix + id;
    // Keep nearby subtitle context without copying an entire episode into session storage for every card.
    const session: EditorSession = {
        cards: cards.map((card) => ({
            ...card,
            surroundingSubtitles: card.surroundingSubtitles.filter(
                (subtitle) => subtitle.end >= card.subtitle.start - 5000 && subtitle.start <= card.subtitle.end + 5000
            ),
        })),
    };
    await storage.set({ [key]: session });
    try {
        const windowId = await popup.create(`${popup.url()}?session=${encodeURIComponent(id)}`);
        if (windowId === undefined) throw new Error('Could not open range editors');
        await storage.set({ [key]: { ...session, windowId } });
    } catch (error) {
        await storage.remove(key);
        throw error;
    }
};

export const loadSubtitleRangeEditors = async (
    id: string,
    storage: SessionStorage = browser.storage.session
): Promise<CardModel[] | undefined> => (await storage.get(sessionPrefix + id))[sessionPrefix + id]?.cards;

export const removeSubtitleRangeEditorsForWindow = async (
    windowId: number,
    storage: SessionStorage = browser.storage.session
): Promise<void> => {
    const sessions = await storage.get(null);
    const keys = Object.entries(sessions)
        .filter(([key, session]) => key.startsWith(sessionPrefix) && session?.windowId === windowId)
        .map(([key]) => key);
    if (keys.length) await storage.remove(keys);
};
