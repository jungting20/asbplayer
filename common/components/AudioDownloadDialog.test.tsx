import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import AudioDownloadDialog from '@project/common/components/AudioDownloadDialog';
import type { AudioClip } from '@project/common/audio-clip';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const download = jest.fn<() => Promise<void>>();
const onClose = jest.fn();

beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    jest.setSystemTime(new Date(2026, 9, 19, 12));
    localStorage.clear();
    download.mockReset().mockResolvedValue(undefined);
    onClose.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
        root.render(
            <AudioDownloadDialog
                audioClip={{ name: 'episode_70000.mp3', extension: 'mp3', download } as unknown as AudioClip}
                onClose={onClose}
            />
        )
    );
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});

const clickButton = async (label: string) => {
    const button = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === label)!;
    await act(async () => button.click());
};

it('prefills today and the next sequence as the actual filename value', async () => {
    const input = document.querySelector('input')!;
    expect(input.value).toBe('20261019_01.mp3');
    await clickButton('action.save');
    expect(download).toHaveBeenCalledWith('20261019_01.mp3');
    expect(onClose).toHaveBeenCalledTimes(1);
});

it('saves a name typed by the user', async () => {
    const input = document.querySelector('input')!;
    act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'listening practice');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickButton('action.save');
    expect(download).toHaveBeenCalledWith('listening practice');
});

it('cancels without downloading', async () => {
    await clickButton('action.cancel');
    expect(download).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps the dialog open and allows retrying when downloading fails', async () => {
    download.mockRejectedValueOnce(new Error('encoding failed'));
    await clickButton('action.save');
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('audioDownload.failed');
    await clickButton('action.save');
    expect(onClose).toHaveBeenCalledTimes(1);
});

it('uses the modal position regardless of download order and keeps it when reopened', async () => {
    localStorage.setItem('asbplayer.audioDownloadSequence', JSON.stringify({ date: '20261019', sequence: 99 }));
    const renderPosition = (position: number, instance: string) =>
        act(() =>
            root.render(
                <AudioDownloadDialog
                    key={instance}
                    audioClip={{ extension: 'mp3', download } as unknown as AudioClip}
                    sequence={position}
                    onClose={onClose}
                />
            )
        );
    renderPosition(2, 'second');
    expect(document.querySelector('input')!.value).toBe('20261019_02.mp3');
    await clickButton('action.save');
    expect(download).toHaveBeenLastCalledWith('20261019_02.mp3');
    renderPosition(1, 'first');
    expect(document.querySelector('input')!.value).toBe('20261019_01.mp3');
    await clickButton('action.save');
    expect(download).toHaveBeenLastCalledWith('20261019_01.mp3');
    renderPosition(2, 'second-reopened');
    expect(document.querySelector('input')!.value).toBe('20261019_02.mp3');
});
