# 아기 성장노트 (BabyDiaryApp)

날마다 아기 사진과 글을 남기는 로컬 기반 SNS 스타일 성장 일기 앱.

## 주요 기능

- **로컬 저장**: 모든 데이터는 기기 내부에 저장 (서버 비용 $0)
- **일기 작성**: 사진 여러 장 + 본문 + 날짜 + 아기 나이 자동 계산
- **AI 자동 작성 (선택)**: 본인의 API 키를 입력하면 사진을 분석해 초안 생성
  - Gemini (무료 티어 추천) / Claude / OpenAI 중 선택
  - API 사용량 초과 시 자동 알림 + 리셋 시각에 푸시 알림
  - 언제든 ON/OFF 토글 가능
- **수동 백업**: 원하는 기간만 PDF 또는 zip으로 내보내기

## 기술 스택

- React Native + Expo (SDK 54)
- Expo Router (파일 기반 라우팅)
- SQLite (expo-sqlite) — 일기 데이터
- Expo FileSystem — 사진 저장
- Expo SecureStore — API 키 암호화 저장
- Expo Notifications — 사용량 리셋 알림
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
  services/          # AI 호출, 사진 저장, 알림
  utils/             # 나이 계산 등 유틸
  types/             # 공유 타입
```

## 개발 환경

```bash
npm install
npx expo start
```

폰에 **Expo Go** 앱 설치 후 QR 코드 스캔하면 실행됨.

## 다음 단계

- 일기 작성 화면 실제 구현 (사진 선택 + AI 초안)
- 달력 뷰
- PDF/zip 내보내기
- 가져오기/복원
