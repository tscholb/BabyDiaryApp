import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { Baby, DiaryWithPhotos } from '../types';
import { getBabyAgeLabel } from '../utils/babyAge';
import { prettyDate } from '../utils/date';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

async function photoToDataUri(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${base64}`;
}

type ExportInput = {
  baby: Baby;
  diaries: DiaryWithPhotos[];
  title: string;
};

async function buildHtml(input: ExportInput): Promise<string> {
  const sections = await Promise.all(
    input.diaries.map(async diary => {
      const photos = await Promise.all(
        diary.photos.map(async p => {
          const src = await photoToDataUri(p.uri);
          return `<img src="${src}" />`;
        })
      );
      const age = getBabyAgeLabel(input.baby.birthDate, new Date(diary.entryDate));
      return `
        <section class="entry">
          <header>
            <h2>${prettyDate(diary.entryDate)}</h2>
            <span class="age">${escapeHtml(age)}</span>
          </header>
          <div class="photos">${photos.join('')}</div>
          ${diary.body ? `<p>${escapeHtml(diary.body)}</p>` : ''}
        </section>
      `;
    })
  );

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(input.title)}</title>
<style>
  @page { size: A4; margin: 24mm 18mm; }
  body { font-family: -apple-system, "Helvetica Neue", "Apple SD Gothic Neo", sans-serif; color: #2D2A2E; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .sub { color: #8A8589; font-size: 13px; margin-bottom: 32px; }
  .entry { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #F0E3DB; page-break-inside: avoid; }
  .entry:last-child { border: 0; }
  .entry header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
  .entry h2 { font-size: 18px; margin: 0; }
  .entry .age { color: #8A8589; font-size: 12px; }
  .photos { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .photos img { width: 48%; border-radius: 6px; object-fit: cover; max-height: 260px; }
  p { font-size: 14px; line-height: 1.7; white-space: pre-wrap; margin: 0; }
</style>
</head>
<body>
  <h1>${escapeHtml(input.baby.name)}의 성장노트</h1>
  <div class="sub">${escapeHtml(input.title)} · 총 ${input.diaries.length}개 기록</div>
  ${sections.join('\n')}
</body>
</html>`;
}

export async function exportDiariesAsPdf(
  input: ExportInput
): Promise<{ ok: true; uri: string } | { ok: false; message: string }> {
  if (input.diaries.length === 0) {
    return { ok: false, message: '선택한 기간에 기록이 없어요' };
  }

  try {
    const html = await buildHtml(input);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const safeName = `${input.baby.name}-${input.title}`.replace(/[/\\:*?"<>|]/g, '_');
    const target = `${FileSystem.cacheDirectory}${safeName}.pdf`;
    await FileSystem.moveAsync({ from: uri, to: target });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(target, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `${safeName}.pdf 공유`,
      });
    }
    return { ok: true, uri: target };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'PDF 생성 실패',
    };
  }
}
