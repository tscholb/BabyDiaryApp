# 아기 성장노트 (BabyDiaryApp)

날마다 아기 사진과 글을 남기는 로컬 기반 SNS 스타일 성장 일기 앱.

## 주요 기능

- **로컬 저장**: 모든 데이터는 기기 내부에 저장 (서버 비용 $0)
- **세션 기반 일기**: 하루를 여러 세션으로 나눠 시간 흐름 기록
- **AI 자동 작성 (선택)**: 본인의 API 키로 사진을 분석해 초안 생성
  - Gemini (무료 티어 추천) / Claude / OpenAI 중 선택
  - 기본 말투 설정 + 1회성 요청사항 입력
  - EXIF 촬영 시각 기반 자연스러운 시간 전환
- **레이아웃**: 폴라로이드 / 깔끔하게 / 격자 중 선택
- **영상 첨부**: 사진 + 영상 혼합 가능 (AI는 사진만 분석)
- **백업**: PDF, zip 파일로 내보내기

## 기술 스택

- React Native + Expo (SDK 55)
- Expo Router (파일 기반 라우팅)
- SQLite (expo-sqlite) — 일기 데이터
- Expo FileSystem — 사진/영상 저장
- Expo Video — 영상 재생
- Expo SecureStore — API 키 암호화 저장
- Expo Notifications — AI 사용량 리셋 알림
- TypeScript

## 폴더 구조

```
app/                 # 화면 (Expo Router 파일 기반)
  (tabs)/            # 하단 탭: 피드 / 달력 / 작성 / 설정
  baby/              # 아기 프로필 생성/수정
  diary/             # 일기 작성/상세
  settings/          # AI/내보내기/가져오기 세부 설정
src/
  db/                # SQLite 스키마 + 쿼리 함수
  services/          # AI 호출, 사진 저장, 알림, 백업, PDF
  components/        # MediaCollage, CalendarGrid 등 공유 컴포넌트
  utils/             # 나이 계산, 날짜, 세션 그룹핑 유틸
  types/             # 공유 타입
```

## 개발 환경

```bash
npm install
npx expo start
```

폰에 **Expo Go** 앱 설치 후 QR 코드 스캔하면 실행됨.

## 배포 (안드로이드 APK)

### 첫 설치 또는 네이티브 모듈 변경 시: 빌드

```bash
npm run build:android
# 또는
npx eas-cli build -p android --profile preview
```

15~25분 소요. QR로 폰에 설치.

### 이후 JS 코드만 수정했을 때: OTA 업데이트

빌드 없이 몇 초 안에 배포:

```bash
npm run update:preview "변경 내용 요약"
# 또는
npx eas-cli update --branch preview --message "변경 내용 요약"
```

- 앱 다음 실행 시 자동으로 최신 JS 번들 받음
- 네이티브 모듈이 바뀌지 않는 한 무제한 무료
- `runtimeVersion` 이 같아야 업데이트 수신 가능 (app.json의 appVersion 기준)

### 네이티브 모듈을 새로 추가/제거했을 때

- `app.json` 의 `version` 을 올려 runtimeVersion 분리
- 다시 `build:android` 해서 새 APK 배포
- 기존 APK 사용자에겐 OTA가 안 가므로 APK 재설치 필요
