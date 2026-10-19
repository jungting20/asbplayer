import AudioClip from '@project/common/audio-clip/audio-clip';
import { AudioErrorCode } from '@project/common';
import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';

// Mock the download utility so tests don't touch the DOM
jest.mock('@project/common/util', () => ({
    download: jest.fn(),
}));

import { download } from '@project/common/util';

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 19, 12));
    localStorage.clear();
    jest.clearAllMocks();
});

afterEach(() => jest.useRealTimers());

const base64Mp3 =
    'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//8AAAA';

function makeAudioClip(error?: AudioErrorCode) {
    return AudioClip.fromBase64('subtitle_file.srt', 1000, 3000, 1, base64Mp3, 'mp3', error);
}

it('download uses today and the first sequence by default', async () => {
    const clip = makeAudioClip();
    await clip.download();

    expect(download).toHaveBeenCalledTimes(1);
    const [blob, name] = (download as jest.Mock).mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(name).toBe('20261019_01.mp3');
});

it('download uses the audio clip name which includes the extension', () => {
    const clip = makeAudioClip();
    expect(clip.name).toMatch(/\.mp3$/);
});

it('download resolves even when the audio clip has an error flag', async () => {
    const clip = makeAudioClip(AudioErrorCode.fileLinkLost);
    // Should not throw – the blob is still available from base64
    await expect(clip.download()).resolves.toBeUndefined();
});

it('download calls download once per invocation', async () => {
    const clip = makeAudioClip();
    const mockDownload = download as jest.Mock;
    mockDownload.mockClear();

    await clip.download();
    await clip.download();

    expect(mockDownload).toHaveBeenCalledTimes(2);
});

it('download accepts a custom file name and adds the audio extension', async () => {
    const clip = makeAudioClip();
    await clip.download('  일본어 듣기 연습  ');
    expect(download).toHaveBeenLastCalledWith(expect.any(Blob), '일본어 듣기 연습.mp3');
    expect(clip.name).not.toBe('일본어 듣기 연습.mp3');
});

it('download does not duplicate an existing extension', async () => {
    await makeAudioClip().download('lesson.MP3');
    expect(download).toHaveBeenLastCalledWith(expect.any(Blob), 'lesson.MP3');
});

it('download falls back to the dated file name for blank input', async () => {
    const clip = makeAudioClip();
    await clip.download('   ');
    expect(download).toHaveBeenLastCalledWith(expect.any(Blob), '20261019_01.mp3');
});

it('increments the default sequence across audio clips and restarts on the next local date', async () => {
    await makeAudioClip().download();
    await makeAudioClip().download();
    expect((download as jest.Mock).mock.calls.map((call) => call[1])).toEqual(['20261019_01.mp3', '20261019_02.mp3']);
    jest.setSystemTime(new Date(2026, 9, 20, 0, 1));
    await makeAudioClip().download();
    expect(download).toHaveBeenLastCalledWith(expect.any(Blob), '20261020_01.mp3');
});

it('advances the sequence after saving the prefilled name', async () => {
    await makeAudioClip().download('20261019_01.mp3');
    await makeAudioClip().download();
    expect(download).toHaveBeenLastCalledWith(expect.any(Blob), '20261019_02.mp3');
});

it('does not advance the sequence when triggering the download fails', async () => {
    (download as jest.MockedFunction<typeof download>).mockImplementationOnce(() => {
        throw new Error('download failed');
    });
    await expect(makeAudioClip().download()).rejects.toThrow('download failed');
    await makeAudioClip().download();
    expect(download).toHaveBeenLastCalledWith(expect.any(Blob), '20261019_01.mp3');
});
