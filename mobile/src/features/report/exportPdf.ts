import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildReportHtml, fold, formatDateFr, type Patient, type ReportPhoto, type Session } from '../../core';
import { photoDataUri, type Settings } from '../../data/storage';

const MAX_PHOTOS = 6;

export interface ExportInput {
  patient: Patient;
  session: Session;
  sessions: Session[];
  settings: Settings;
}

function safeFileName(text: string): string {
  return fold(text)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Génère le bilan PDF (sur l'appareil) et ouvre la feuille de partage. */
export async function exportReportPdf({ patient, session, sessions, settings }: ExportInput): Promise<string> {
  const photos: ReportPhoto[] = [];
  for (const p of session.photos.slice(-MAX_PHOTOS)) {
    const dataUri = await photoDataUri(p.uri);
    if (dataUri) photos.push({ dataUri, caption: p.caption });
  }

  const html = buildReportHtml({
    patient,
    session,
    history: sessions,
    practitioner: {
      name: settings.practitionerName || 'Praticien',
      title: settings.practitionerTitle,
    },
    photos,
    generatedAt: new Date(),
  });

  // A4 en points (72 ppp).
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const name = safeFileName(`Bilan_${patient.lastName}_${patient.firstName}_${formatDateFr(session.date).replace(/\//g, '-')}`);
  const dest = new File(Paths.cache, `${name}.pdf`);
  if (dest.exists) dest.delete();
  await new File(uri).move(dest);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Bilan ${patient.firstName} ${patient.lastName}`,
    });
  }
  return dest.uri;
}
