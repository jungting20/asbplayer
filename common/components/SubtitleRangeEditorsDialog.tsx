import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AnkiDialog from '@project/common/components/AnkiDialog';
import type { CardModel } from '@project/common';
import type { ExportParams } from '@project/common/anki';
import { humanReadableTime } from '@project/common/util';

interface Props extends Omit<
    ComponentProps<typeof AnkiDialog>,
    'open' | 'disabled' | 'card' | 'onProceed' | 'onCancel' | 'embedded' | 'title'
> {
    cards: CardModel[];
    onClose: () => void;
    onExported: () => void;
}

export default function SubtitleRangeEditorsDialog({ cards, onClose, onExported, ...editorProps }: Props) {
    const { t } = useTranslation();
    const [entries, setEntries] = useState(() =>
        cards.map((card, index) => ({
            card,
            index,
            saving: false,
            error: '',
        }))
    );
    const saving = entries.some((entry) => entry.saving);
    useEffect(() => {
        if (entries.length === 0) onClose();
    }, [entries.length, onClose]);

    const closeEntry = (index: number) => {
        if (entries.find((entry) => entry.index === index)?.saving) return;
        setEntries((entries) => entries.filter((entry) => entry.index !== index));
    };

    const proceed = async (index: number, params: ExportParams) => {
        setEntries((entries) =>
            entries.map((entry) => (entry.index === index ? { ...entry, saving: true, error: '' } : entry))
        );
        try {
            await editorProps.anki.export(params);
            onExported();
            if (params.mode !== 'gui') {
                setEntries((entries) => entries.filter((entry) => entry.index !== index));
            }
        } catch (error) {
            setEntries((entries) =>
                entries.map((entry) =>
                    entry.index === index
                        ? {
                              ...entry,
                              error: error instanceof Error ? error.message : String(error),
                          }
                        : entry
                )
            );
        } finally {
            setEntries((entries) =>
                entries.map((entry) => (entry.index === index ? { ...entry, saving: false } : entry))
            );
        }
    };

    return (
        <Dialog open fullScreen onClose={saving ? undefined : onClose} aria-labelledby="subtitle-range-editors-title">
            <Toolbar sx={{ gap: 2 }}>
                <Typography id="subtitle-range-editors-title" variant="h6" sx={{ flex: 1 }}>
                    {t('subtitleTimeFilter.editorsTitle', { count: entries.length })}
                </Typography>
                <Button disabled={saving} onClick={onClose}>
                    {t('subtitleTimeFilter.closeEditors')}
                </Button>
            </Toolbar>
            <DialogContent
                sx={{
                    p: { xs: 1, md: 2 },
                    minHeight: 0,
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        lg: 'repeat(4, minmax(0, 1fr))',
                    },
                    gridAutoRows: { xs: 'minmax(420px, 1fr)', lg: 'minmax(0, 1fr)' },
                }}
            >
                {entries.map(({ card, index, saving, error }) => (
                    <Box key={index} sx={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                            <AnkiDialog
                                {...editorProps}
                                embedded
                                open
                                disabled={saving}
                                card={card}
                                title={`${index + 1}. ${humanReadableTime(card.subtitle.start, true)} ~ ${humanReadableTime(card.subtitle.end, true)}`}
                                onCancel={() => closeEntry(index)}
                                onProceed={(params) => proceed(index, params)}
                            />
                        </Box>
                    </Box>
                ))}
            </DialogContent>
        </Dialog>
    );
}
