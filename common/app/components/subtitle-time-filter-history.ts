import { parseSubtitleTimeRanges } from '@project/common/app/components/subtitle-time-filter';

const storageKey = 'asbplayer.lastSubtitleTimeFilter';

export const loadLastSubtitleTimeFilter = (): string => {
    try {
        const text = localStorage.getItem(storageKey) ?? '';
        const { ranges, errorLine } = parseSubtitleTimeRanges(text);
        return errorLine === undefined && ranges.length > 0 ? text : '';
    } catch {
        return '';
    }
};

export const saveLastSubtitleTimeFilter = (text: string): void => {
    const { ranges, errorLine } = parseSubtitleTimeRanges(text);
    // Clearing the active filter keeps the last useful entry available for restoring.
    if (errorLine !== undefined || ranges.length === 0) return;
    try {
        localStorage.setItem(storageKey, text);
    } catch {
        // Filtering remains available when browser storage is unavailable.
    }
};
