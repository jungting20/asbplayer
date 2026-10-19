const sequenceKey = 'asbplayer.audioDownloadSequence';

const localDate = () => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
};

const lastSequence = (date: string): number => {
    try {
        const stored = JSON.parse(localStorage.getItem(sequenceKey) ?? 'null');
        return stored?.date === date && Number.isSafeInteger(stored.sequence) && stored.sequence >= 0
            ? stored.sequence
            : 0;
    } catch {
        return 0;
    }
};

// Range editors supply a fixed position; other downloads use the next daily sequence.
// Previewing or cancelling a download does not consume a number.
export const defaultAudioFileName = (extension: string, sequence?: number): string => {
    const date = localDate();
    return `${date}_${String(sequence ?? lastSequence(date) + 1).padStart(2, '0')}.${extension}`;
};

export const recordAudioFileDownload = (fileName: string): void => {
    const match = /^(\d{8})_(\d+)\.[^.]+$/.exec(fileName);
    const date = localDate();
    if (!match || match[1] !== date) return;
    const sequence = Number(match[2]);
    if (!Number.isSafeInteger(sequence) || sequence <= lastSequence(date)) return;
    localStorage.setItem(sequenceKey, JSON.stringify({ date, sequence }));
};
