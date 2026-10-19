import type { CardModel, SubtitleModel } from '@project/common';

export interface SubtitleTimeRange {
    start: number;
    end: number;
}

export interface ParsedSubtitleTimeRanges {
    ranges: SubtitleTimeRange[];
    errorLine?: number;
}

const parseTimestamp = (text: string): number | undefined => {
    const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(text.trim());
    if (!match) return undefined;
    const [, hours, minutes, seconds, fraction] = match;
    if (Number(seconds) >= 60 || (hours !== undefined && Number(minutes) >= 60)) return undefined;
    return (
        ((Number(hours ?? 0) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 +
        Number((fraction ?? '').padEnd(3, '0'))
    );
};

// Blank input clears the filter. A malformed line never partially applies the list.
export const parseSubtitleTimeRanges = (text: string): ParsedSubtitleTimeRanges => {
    const ranges: SubtitleTimeRange[] = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (!line.trim()) continue;
        const parts = line.split('~');
        const start = parts.length === 2 ? parseTimestamp(parts[0]) : undefined;
        const end = parts.length === 2 ? parseTimestamp(parts[1]) : undefined;
        if (start === undefined || end === undefined || start >= end) {
            return { ranges: [], errorLine: index + 1 };
        }
        ranges.push({ start, end });
    }
    return { ranges };
};

export const subtitleOverlapsTimeRanges = (
    subtitle: { start: number; end: number },
    ranges: readonly SubtitleTimeRange[]
): boolean => ranges.length === 0 || ranges.some((range) => subtitle.start < range.end && subtitle.end > range.start);

// Keep the original array indexes for seeking, mining, annotations, and playback highlights.
export const subtitleTimeFilterIndexes = (
    subtitles: readonly { start: number; end: number }[],
    ranges: readonly SubtitleTimeRange[]
): number[] => subtitles.flatMap((subtitle, index) => (subtitleOverlapsTimeRanges(subtitle, ranges) ? [index] : []));

export const subtitleTimeRangeCards = (
    subtitles: SubtitleModel[],
    ranges: readonly SubtitleTimeRange[],
    subtitleFileNames: readonly string[]
): CardModel[] =>
    ranges.map((range) => {
        const matches = subtitles.filter((subtitle) => subtitleOverlapsTimeRanges(subtitle, [range]));
        const track = matches[0]?.track ?? 0;
        const subtitle: SubtitleModel = {
            ...range,
            originalStart: range.start,
            originalEnd: range.end,
            track,
            text: matches
                .filter((match) => match.track === track)
                .map((match) => match.text)
                .join('\n'),
        };
        return {
            subtitle,
            surroundingSubtitles: matches.length ? subtitles : [subtitle],
            subtitleFileName: subtitleFileNames[track] ?? '',
            mediaTimestamp: range.start,
        };
    });
