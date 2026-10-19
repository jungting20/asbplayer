import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { ComponentProps, RefObject } from 'react';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import SubtitleRangeEditorsDialog from '@project/common/components/SubtitleRangeEditorsDialog';
import { subtitleTimeRangeCards } from '@project/common/app/components/subtitle-time-filter';
import type { AudioModel, CardModel } from '@project/common';
import type { AnkiDialogState } from '@project/common/components/AnkiDialog';
import type { ExportParams } from '@project/common/anki';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@project/common/components/AnkiDialog', () => ({
    __esModule: true,
    default: ({
        card,
        title,
        embedded,
        audioDownloadSequence,
        onCancel,
        onProceed,
        onRerecord,
        stateRef,
        disabled,
    }: {
        card: CardModel;
        title: string;
        embedded: boolean;
        audioDownloadSequence?: number;
        disabled: boolean;
        onRerecord?: () => void;
        stateRef: RefObject<AnkiDialogState | undefined>;
        onCancel: () => void;
        onProceed: (params: ExportParams) => Promise<void>;
    }) => {
        stateRef.current = { timestampInterval: [1000, 2500], text: 'edited sentence' } as AnkiDialogState;
        return (
            <section
                aria-label={title}
                data-embedded={embedded}
                data-sequence={audioDownloadSequence}
                data-start={card.subtitle.start}
            >
                <input defaultValue={card.subtitle.text} aria-label={title} />
                <button onClick={onCancel}>Close {title}</button>
                <button disabled={disabled} onClick={() => void onProceed({ mode: 'default' } as ExportParams)}>
                    Save {title}
                </button>
                {onRerecord && (
                    <button disabled={disabled} onClick={onRerecord}>
                        Record
                    </button>
                )}
                {card.audio && <span>recorded:{card.audio.base64}</span>}
            </section>
        );
    },
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

const renderEditors = (
    count: number | CardModel[],
    onRecord?: ComponentProps<typeof SubtitleRangeEditorsDialog>['onRecord']
) => {
    const cards = Array.isArray(count)
        ? count
        : subtitleTimeRangeCards(
              [],
              Array.from({ length: count }, (_, i) => ({ start: i * 10000, end: i * 10000 + 5000 })),
              []
          );
    const props = { cards, onClose, onExported, onRecord, anki: { export: exportCard } } as unknown as ComponentProps<
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

it('records only on click, uses the edited selection, and attaches audio without losing edits', async () => {
    const audio: AudioModel = { base64: 'recorded-clip', extension: 'webm' };
    const onRecord = jest
        .fn<(card: CardModel, state: AnkiDialogState) => Promise<AudioModel>>()
        .mockResolvedValue(audio);
    renderEditors(2, onRecord);
    expect(onRecord).not.toHaveBeenCalled();
    const input = document.querySelector('input')!;
    input.value = 'unfinished edit';
    await act(async () => (document.querySelectorAll('section button')[2] as HTMLButtonElement).click());
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord.mock.calls[0][1].timestampInterval).toEqual([1000, 2500]);
    expect(document.querySelector('input')).toBe(input);
    expect(input.value).toBe('unfinished edit');
    expect(document.querySelectorAll('section')[0].textContent).toContain('recorded:recorded-clip');
    expect(document.querySelectorAll('section')[1].textContent).not.toContain('recorded:');
    expect(exportCard).not.toHaveBeenCalled();
});

it('keeps editors and edits available after a recording failure and supports retry', async () => {
    const onRecord = jest
        .fn<(card: CardModel, state: AnkiDialogState) => Promise<AudioModel>>()
        .mockRejectedValueOnce(new Error('No permission to record'))
        .mockResolvedValue({ base64: 'retry-clip', extension: 'webm' });
    renderEditors(1, onRecord);
    const record = document.querySelectorAll('section button')[2] as HTMLButtonElement;
    await act(async () => record.click());
    expect(document.body.textContent).toContain('No permission to record');
    expect(record.disabled).toBe(false);
    await act(async () => record.click());
    expect(document.body.textContent).toContain('recorded:retry-clip');
    expect(document.body.textContent).not.toContain('No permission to record');
});

it('assigns download numbers in chronological order and keeps them after an earlier editor closes', () => {
    const cards = subtitleTimeRangeCards(
        [],
        [
            { start: 30000, end: 35000 },
            { start: 10000, end: 15000 },
            { start: 20000, end: 25000 },
        ],
        []
    );
    renderEditors(cards);
    const editors = () =>
        Array.from(document.querySelectorAll('section')).map((section) => [
            section.getAttribute('data-start'),
            section.getAttribute('data-sequence'),
        ]);
    expect(editors()).toEqual([
        ['10000', '1'],
        ['20000', '2'],
        ['30000', '3'],
    ]);
    expect(cards.map((card) => card.subtitle.start)).toEqual([30000, 10000, 20000]);
    act(() => (document.querySelector('section button') as HTMLButtonElement).click());
    expect(editors()).toEqual([
        ['20000', '2'],
        ['30000', '3'],
    ]);
});
