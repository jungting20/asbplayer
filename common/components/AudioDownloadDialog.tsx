import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import type { AudioClip } from '@project/common/audio-clip';
import { defaultAudioFileName } from '@project/common/audio-clip/audio-file-name';

interface Props {
    audioClip: AudioClip;
    onClose: () => void;
}

export default function AudioDownloadDialog({ audioClip, onClose }: Props) {
    const { t } = useTranslation();
    const [fileName, setFileName] = useState(() => defaultAudioFileName(audioClip.extension));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);

    const save = async () => {
        if (saving) return;
        setSaving(true);
        setError(false);
        try {
            await audioClip.download(fileName);
            onClose();
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open fullWidth maxWidth="sm" onClose={saving ? undefined : onClose}>
            <DialogTitle>{t('action.downloadAudio')}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    fullWidth
                    margin="dense"
                    label={t('audioDownload.fileName')}
                    value={fileName}
                    disabled={saving}
                    onChange={(event) => setFileName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            void save();
                        }
                    }}
                    error={error}
                    helperText={
                        error ? t('audioDownload.failed') : t('audioDownload.help', { extension: audioClip.extension })
                    }
                />
            </DialogContent>
            <DialogActions>
                <Button disabled={saving} onClick={onClose}>
                    {t('action.cancel')}
                </Button>
                <Button disabled={saving} onClick={() => void save()}>
                    {t('action.save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
