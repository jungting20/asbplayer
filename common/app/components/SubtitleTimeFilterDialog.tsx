import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { parseSubtitleTimeRanges } from '@project/common/app/components/subtitle-time-filter';
import type { SubtitleTimeRange } from '@project/common/app/components/subtitle-time-filter';
import {
    loadLastSubtitleTimeFilter,
    saveLastSubtitleTimeFilter,
} from '@project/common/app/components/subtitle-time-filter-history';

interface Props {
    value: string;
    onApply: (text: string, ranges: SubtitleTimeRange[]) => void;
    onClose: () => void;
}

export default function SubtitleTimeFilterDialog({ value, onApply, onClose }: Props) {
    const { t } = useTranslation();
    const [lastSaved] = useState(loadLastSubtitleTimeFilter);
    const [text, setText] = useState(() => value || lastSaved);
    const { ranges, errorLine } = parseSubtitleTimeRanges(text);
    return (
        <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
            <DialogTitle>{t('subtitleTimeFilter.title')}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    fullWidth
                    multiline
                    minRows={6}
                    maxRows={12}
                    margin="dense"
                    label={t('subtitleTimeFilter.ranges')}
                    placeholder={'00:01:10 ~ 00:01:25\n00:03:00 ~ 00:03:40'}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    error={errorLine !== undefined}
                    helperText={
                        errorLine === undefined
                            ? t('subtitleTimeFilter.help')
                            : t('subtitleTimeFilter.invalidLine', { line: errorLine })
                    }
                />
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap' }}>
                <Button disabled={!lastSaved} onClick={() => setText(lastSaved)}>
                    {t('subtitleTimeFilter.loadLast')}
                </Button>
                <Button onClick={() => onApply('', [])}>{t('subtitleTimeFilter.clear')}</Button>
                <Button onClick={onClose}>{t('action.cancel')}</Button>
                <Button
                    disabled={errorLine !== undefined}
                    onClick={() => {
                        saveLastSubtitleTimeFilter(text);
                        onApply(text, ranges);
                    }}
                >
                    {t('subtitleTimeFilter.apply')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
