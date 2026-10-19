import { expect, it } from '@jest/globals';
import { boundaryIntervalFromCard } from '@project/common/components/AnkiDialog';

const subtitle = { start: 1000, end: 5000, originalStart: 1000, originalEnd: 5000, track: 0, text: 'one subtitle' };

it('keeps a valid editing interval when a range has only one subtitle', () => {
    expect(boundaryIntervalFromCard(subtitle, [subtitle])).toEqual([1000, 5000]);
});

it('keeps a valid editing interval when no surrounding subtitles are available', () => {
    expect(boundaryIntervalFromCard(subtitle, [])).toEqual([1000, 5000]);
});

it('keeps the complete requested interval when a subtitle only partially overlaps', () => {
    const range = { ...subtitle, start: 2000, end: 9000 };
    expect(boundaryIntervalFromCard(range, [subtitle])).toEqual([2000, 9000]);
});
