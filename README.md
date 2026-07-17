# 한 톨의 시간 (Rice Count)

밥그릇 속 쌀알을 젓가락으로 옮겨 세고, 기록을 경쟁하는 Next.js 게임입니다.

## 실행

```bash
npm install
npm run dev
```

서버 검증과 전 세계 랭킹은 Firebase Auth/Firestore와 Vercel API Routes를 사용합니다. `.env.example`을 `.env.local`로 복사해 Firebase Web App 값과 Admin SDK 서비스 계정 값을 채우세요.

Firestore에는 `rankings` 컬렉션을 사용합니다. 난이도별 조회를 처음 실행할 때 콘솔에 표시되는 링크에서 `difficulty ASC, seconds ASC` 복합 색인을 생성해야 합니다.

Firestore 보안 규칙은 브라우저에서 `rankings`, `gameResults`, `gameSessions`를 직접 쓰지 못하게 막고, Vercel API Route가 Admin SDK로만 기록하도록 구성합니다.

## Vercel

이 프로젝트는 Next.js API Routes를 사용하므로 Vercel 배포가 필요합니다. GitHub Pages 정적 export 배포는 더 이상 사용하지 않습니다.

Vercel Project Settings → Environment Variables에 `.env.example`의 값을 등록하세요. `FIREBASE_PRIVATE_KEY`는 서비스 계정 JSON의 `private_key` 값을 그대로 넣되 줄바꿈은 `\n` 문자열로 들어가도 앱에서 처리합니다.

멀티라인 private key가 Vercel에서 꼬이면 서비스 계정 JSON 전체를 base64로 인코딩해 `FIREBASE_SERVICE_ACCOUNT_BASE64`에 한 줄로 넣을 수 있습니다. 이 값을 쓰면 `FIREBASE_CLIENT_EMAIL`과 `FIREBASE_PRIVATE_KEY`는 비워도 됩니다.
