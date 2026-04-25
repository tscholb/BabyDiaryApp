import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { Baby, DiaryWithPhotos } from '../types';
import { getBabyAgeLabel } from '../utils/babyAge';
import { prettyDate } from '../utils/date';
import { groupPhotosBySession } from '../utils/sessions';

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
      const byUri = new Map<string, (typeof diary.photos)[number]>();
      for (const p of diary.photos) byUri.set(p.uri, p);
      const sessionUris = groupPhotosBySession(diary.photos).filter(
        s => s.length > 0
      );
      const renderedSessions = await Promise.all(
        sessionUris.map(async uris => {
          const imgs = await Promise.all(
            uris.map(async uri => {
              const photo = byUri.get(uri);
              const isVideo = photo?.mediaType === 'video';
              const renderUri =
                isVideo && photo?.thumbnailUri ? photo.thumbnailUri : uri;
              const src = await photoToDataUri(renderUri);
              return isVideo
                ? `<div class="video-cell"><img src="${src}" /><span class="play">▶</span></div>`
                : `<img src="${src}" />`;
            })
          );
          return `<div class="photos">${imgs.join('')}</div>`;
        })
      );

      const sessionTexts = diary.sessionBodies.length > 0
        ? sessionUris.map((_, i) => diary.sessionBodies[i] ?? '')
        : [];
      const hasInterleavedTexts = sessionTexts.some(t => t && t.trim().length > 0);

      let photosBlock = '';
      if (sessionUris.length === 1) {
        photosBlock =
          renderedSessions[0] +
          (sessionTexts[0]
            ? `<p>${escapeHtml(sessionTexts[0])}</p>`
            : diary.body
            ? `<p>${escapeHtml(diary.body)}</p>`
            : '');
      } else if (hasInterleavedTexts) {
        photosBlock = renderedSessions
          .map(
            (s, i) =>
              `<div class="session-group">${s}${
                sessionTexts[i] ? `<p>${escapeHtml(sessionTexts[i])}</p>` : ''
              }</div>`
          )
          .join('<div class="session-divider"></div>');
      } else {
        photosBlock =
          renderedSessions
            .map(s => `<div class="session-group">${s}</div>`)
            .join('<div class="session-divider"></div>') +
          (diary.body ? `<p>${escapeHtml(diary.body)}</p>` : '');
      }

      const age = getBabyAgeLabel(input.baby.birthDate, new Date(diary.entryDate));
      return `
        <section class="entry">
          <header>
            <h2>${prettyDate(diary.entryDate)}</h2>
            <span class="age">${escapeHtml(age)}</span>
          </header>
          ${photosBlock}
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
  .video-cell { width: 48%; position: relative; }
  .video-cell img { width: 100%; border-radius: 6px; object-fit: cover; max-height: 260px; }
  .video-cell .play { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; border-radius: 20px; background: rgba(0,0,0,0.55); color: #fff; font-size: 16px; display: flex; align-items: center; justify-content: center; }
  .session-divider { height: 1px; background: #F0E3DB; width: 40%; margin: 12px auto; }
  .session-group { margin-bottom: 8px; }
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
