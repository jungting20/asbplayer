import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import SubtitleRangeEditorsDialog from '@project/common/components/SubtitleRangeEditorsDialog';
import { subtitleTimeRangeCards } from '@project/common/app/components/subtitle-time-filter';
import type { CardModel } from '@project/common';
import type { ExportParams } from '@project/common/anki';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@project/common/components/AnkiDialog', () => ({
    __esModule: true,
    default: ({
        card,
        title,
        embedded,
        onCancel,
        onProceed,
    }: {
        card: CardModel;
        title: string;
        embedded: boolean;
        onCancel: () => void;
        onProceed: (params: ExportParams) => Promise<void>;
    }) => (
        <section aria-label={title} data-embedded={embedded}>
            <input defaultValue={card.subtitle.text} aria-label={title} />
            <button onClick={onCancel}>Close {title}</button>
            <button onClick={() => void onProceed({ mode: 'default' } as ExportParams)}>Save {title}</button>
        </section>
    ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
const onClose = jest.fn();
const onExported = jest.fn();
const exportCard = jest.fn<() => Promise<string>>();

beforeEach(() => {
    onClose.mockClear();
    onExported.mockClear();
    exportCard.mockReset().mockResolvedValue('saved');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const renderEditors = (count: number) => {
    const cards = subtitleTimeRangeCards(
        [],
        Array.from({ length: count }, (_, i) => ({ start: i * 10000, end: i * 10000 + 5000 })),
        []
    );
    const props = { cards, onClose, onExported, anki: { export: exportCard } } as unknown as ComponentProps<
        typeof SubtitleRangeEditorsDialog
    >;
    act(() => root.render(<SubtitleRangeEditorsDialog {...props} />));
};

it('opens seven independent embedded editors without exporting, and closing one preserves the others', () => {
    renderEditors(7);
    expect(document.querySelectorAll('section[data-embedded="true"]')).toHaveLength(7);
    expect(exportCard).not.toHaveBeenCalled();
    const inputs = document.querySelectorAll('input');
    inputs[1].value = 'unfinished edit';
    act(() => (document.querySelector('section button') as HTMLButtonElement).click());
    expect(document.querySelectorAll('section')).toHaveLength(6);
    expect(document.querySelector('input')!.value).toBe('unfinished edit');
    expect(onClose).not.toHaveBeenCalled();
});

it('closes the workspace when the last editor is closed', () => {
    renderEditors(1);
    act(() => (document.querySelector('section button') as HTMLButtonElement).click());
    expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps failed exports open for retry', async () => {
    exportCard.mockRejectedValueOnce(new Error('Anki unavailable'));
    renderEditors(1);
    const save = document.querySelectorAll('section button')[1] as HTMLButtonElement;
    await act(async () => save.click());
    expect(document.body.textContent).toContain('Anki unavailable');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => save.click());
    expect(onExported).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
});

it('closes when the final two exports complete together', async () => {
    renderEditors(2);
    const buttons = document.querySelectorAll('section button');
    await act(async () => {
        (buttons[1] as HTMLButtonElement).click();
        (buttons[3] as HTMLButtonElement).click();
    });
    expect(exportCard).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(1);
});
