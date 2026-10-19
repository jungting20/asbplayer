import { describe, expect, it } from '@jest/globals';
import {
    parseSubtitleTimeRanges,
    subtitleTimeFilterIndexes,
    subtitleTimeRangeCards,
} from '@project/common/app/components/subtitle-time-filter';

describe('subtitle time range input', () => {
    it('parses multiple ranges, whitespace, CRLF, and blank lines', () => {
        expect(parseSubtitleTimeRanges(' 00:01:10 ~ 00:01:25\r\n\r\n00:03:00 ~ 00:03:40 ')).toEqual({
            ranges: [
                { start: 70000, end: 85000 },
                { start: 180000, end: 220000 },
            ],
        });
    });

    it('supports minutes, long hours, and fractional seconds', () => {
        expect(parseSubtitleTimeRanges('01:10.5 ~ 01:25,050\n100:00:00 ~ 100:00:01')).toEqual({
            ranges: [
                { start: 70500, end: 85050 },
                { start: 360000000, end: 360001000 },
            ],
        });
    });

    it.each([
        'invalid',
        '00:60:00 ~ 01:00:00',
        '00:01:60 ~ 00:02:00',
        '01:10 ~ 01:10',
        '02:00 ~ 01:00',
        '-01:10 ~ 02:00',
        '01:10 ~ 02:00 ~ 03:00',
    ])('rejects an invalid line atomically: %s', (line) => {
        expect(parseSubtitleTimeRanges(`00:00:01 ~ 00:00:02\n\n${line}`)).toEqual({ ranges: [], errorLine: 3 });
    });

    it('clears the filter for empty input', () => {
        expect(parseSubtitleTimeRanges(' \n\n')).toEqual({ ranges: [] });
    });
});

describe('subtitle time filtering', () => {
    const subtitles = [
        { start: 0, end: 1000 },
        { start: 900, end: 1200 },
        { start: 1500, end: 1800 },
        { start: 1900, end: 2100 },
        { start: 4000, end: 5000 },
    ];

    it('keeps original indexes and includes partial overlaps across multiple ranges', () => {
        expect(
            subtitleTimeFilterIndexes(subtitles, [
                { start: 1000, end: 2000 },
                { start: 4500, end: 4700 },
            ])
        ).toEqual([1, 2, 3, 4]);
    });

    it('does not duplicate subtitles for overlapping or unsorted ranges', () => {
        expect(
            subtitleTimeFilterIndexes(subtitles, [
                { start: 1700, end: 2000 },
                { start: 1000, end: 1900 },
            ])
        ).toEqual([1, 2, 3]);
    });

    it('excludes cues that only touch the boundary', () => {
        expect(subtitleTimeFilterIndexes(subtitles, [{ start: 1200, end: 1500 }])).toEqual([]);
    });

    it('returns all subtitles after clearing and no subtitles for an unmatched range', () => {
        expect(subtitleTimeFilterIndexes(subtitles, [])).toEqual([0, 1, 2, 3, 4]);
        expect(subtitleTimeFilterIndexes(subtitles, [{ start: 6000, end: 7000 }])).toEqual([]);
    });
});

it('builds one unrecorded card per range, preserves exact times, and includes overlapping subtitles', () => {
    const subtitles = [
        { start: 900, end: 1200, originalStart: 900, originalEnd: 1200, track: 0, text: 'partial' },
        { start: 1500, end: 1800, originalStart: 1500, originalEnd: 1800, track: 0, text: 'inside' },
        { start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, track: 0, text: 'other' },
    ];
    const cards = subtitleTimeRangeCards(
        subtitles,
        [
            { start: 1000, end: 2000 },
            { start: 8000, end: 9000 },
        ],
        ['episode.srt']
    );
    expect(cards).toHaveLength(2);
    expect(cards[0].subtitle).toMatchObject({ start: 1000, end: 2000, text: 'partial\ninside' });
    expect(cards[0].subtitleFileName).toBe('episode.srt');
    expect(cards[1].subtitle).toMatchObject({ start: 8000, end: 9000, text: '' });
    expect(cards[1].surroundingSubtitles).toEqual([cards[1].subtitle]);
    expect(cards.every((card) => card.audio === undefined)).toBe(true);
});
