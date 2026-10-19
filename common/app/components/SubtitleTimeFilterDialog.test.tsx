import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import SubtitleTimeFilterDialog from '@project/common/app/components/SubtitleTimeFilterDialog';
import {
    loadLastSubtitleTimeFilter,
    saveLastSubtitleTimeFilter,
} from '@project/common/app/components/subtitle-time-filter-history';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const onApply = jest.fn();
const onClose = jest.fn();
const savedRanges = '00:01:10 ~ 00:01:25\n00:03:00 ~ 00:03:40';
const otherRange = '00:05:00 ~ 00:05:10';

beforeEach(() => {
    localStorage.clear();
    onApply.mockClear();
    onClose.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

const renderDialog = (value = '', instance = 'initial') =>
    act(() =>
        root.render(<SubtitleTimeFilterDialog key={instance} value={value} onApply={onApply} onClose={onClose} />)
    );
const input = () => document.querySelector('textarea:not([aria-hidden])') as HTMLTextAreaElement;
const type = (text: string) =>
    act(() => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input(), text);
        input().dispatchEvent(new Event('input', { bubbles: true }));
    });
const click = (label: string) =>
    act(() => {
        Array.from(document.querySelectorAll('button'))
            .find((button) => button.textContent === label)!
            .click();
    });

it('saves applied ranges and restores the exact text after reopening without automatically applying it', () => {
    renderDialog();
    type(savedRanges);
    click('subtitleTimeFilter.apply');
    expect(onApply).toHaveBeenCalledWith(savedRanges, [
        { start: 70000, end: 85000 },
        { start: 180000, end: 220000 },
    ]);
    renderDialog('', 'reopened');
    expect(input().value).toBe(savedRanges);
    expect(onApply).toHaveBeenCalledTimes(1);
});

it('keeps the last saved ranges when edits are cancelled or the active filter is cleared', () => {
    saveLastSubtitleTimeFilter(savedRanges);
    renderDialog(otherRange);
    expect(input().value).toBe(otherRange);
    type('unfinished input');
    click('action.cancel');
    expect(loadLastSubtitleTimeFilter()).toBe(savedRanges);
    renderDialog(otherRange, 'reopened');
    click('subtitleTimeFilter.clear');
    expect(onApply).toHaveBeenCalledWith('', []);
    expect(loadLastSubtitleTimeFilter()).toBe(savedRanges);
    click('subtitleTimeFilter.loadLast');
    expect(input().value).toBe(savedRanges);
});

it('does not replace saved ranges with malformed or empty input', () => {
    saveLastSubtitleTimeFilter(savedRanges);
    saveLastSubtitleTimeFilter('invalid');
    saveLastSubtitleTimeFilter('');
    expect(loadLastSubtitleTimeFilter()).toBe(savedRanges);
    renderDialog();
    type('invalid');
    click('subtitleTimeFilter.apply');
    expect(onApply).not.toHaveBeenCalled();
    expect(loadLastSubtitleTimeFilter()).toBe(savedRanges);
});

it('still applies the filter when browser storage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Unavailable');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Unavailable');
    });
    renderDialog();
    type(otherRange);
    click('subtitleTimeFilter.apply');
    expect(onApply).toHaveBeenCalledWith(otherRange, [{ start: 300000, end: 310000 }]);
});
