# 한 톨의 시간 (Rice Count)

밥그릇 속 쌀알을 젓가락으로 옮겨 세고, 기록을 경쟁하는 Next.js 게임입니다.

## 실행

```bash
npm install
npm run dev
```

Firebase를 설정하지 않아도 브라우저 `localStorage`에 랭킹이 저장됩니다. 전 세계 랭킹을 사용하려면 `.env.example`을 `.env.local`로 복사해 Firebase Web App 값을 채우고 Firestore를 활성화하세요.

Firestore에는 `rankings` 컬렉션을 사용합니다. 난이도별 조회를 처음 실행할 때 콘솔에 표시되는 링크에서 `difficulty ASC, seconds ASC` 복합 색인을 생성해야 합니다.

개발용 보안 규칙 예시:

```txt
match /rankings/{score} {
  allow read: if true;
  allow create: if
    request.resource.data.name is string &&
    request.resource.data.name.size() <= 12 &&
    request.resource.data.difficulty in ['easy', 'normal', 'hard'] &&
    request.resource.data.seconds is number &&
    request.resource.data.seconds > 0;
  allow update, delete: if false;
}
```

## GitHub Pages

저장소의 Settings → Pages → Source를 **GitHub Actions**로 설정하세요. `main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 정적 사이트를 빌드하고 배포합니다. Firebase 값은 저장소의 Settings → Secrets and variables → Actions에 같은 이름으로 등록하세요.
