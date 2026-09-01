# Cloudways → Vercel 이관 가이드

작성 2026-09-01. 대상 도메인 `snapnote.myjane.co.kr`.

## 이관 전 현황

| 항목 | 값 |
|---|---|
| 호스팅 | Cloudways (Nginx + PM2, `ecosystem.config.cjs`, 포트 3001) |
| 서버 IP | `165.22.247.25` (SnapWord·apex 사이트와 공용) |
| 배포 | GitHub Actions → SSH → `npm ci` + build + PM2 reload |
| 네임서버 | 가비아 |
| DNS | `snapnote.myjane.co.kr` A → `165.22.247.25` |
| DB | MongoDB Atlas |
| 스토리지 | Cloudflare R2 (`snapnote-uploads`) |
| 외부 API | OpenAI (챗 / Vision) |

> ⚠️ 같은 서버에 apex(`myjane.co.kr`) 사이트가 정상 운영 중이다.
> **이관 대상은 `snapnote` 서브도메인 뿐이며, apex와 서버는 건드리지 않는다.**
> SnapWord는 2026-09-01 먼저 Vercel로 이관 완료했다.

## 1. 코드 변경 (완료)

핵심 문제는 Vercel Functions의 **요청 본문 4.5MB 제한**이다. 이 한도를 넘으면
함수 코드에 닿기도 전에 `FUNCTION_PAYLOAD_TOO_LARGE`로 잘리므로, 라우트의
`MAX` 검사는 의미가 없다.

SnapNote는 업로드 경로가 두 개였다.

### 노트 이미지 업로드 (`/api/upload-image` → R2)

업로드되는 파일은 사용자가 촬영한 사진을 **크롭 → 이진화(모노톤)** 한 결과다.
이진화 PNG는 잡음이 많을수록 커져서 원본 해상도로는 수 MB를 넘기 쉬웠다.

- `lib/clientImage.ts` 신규 — 해상도 계산·인코딩·용량 검사 공통 유틸
- `components/ImageCropper.tsx` — 크롭 결과 긴 변을 **2400px**로 제한
- `components/MonoAdjust.tsx` — 이진화도 2400px 기준으로 수행하고,
  결과가 3.5MB를 넘으면 **1800px → 1400px로 자동 재인코딩**한다.
  사용자가 용량 오류를 만나는 상황을 사실상 없앴다.
  (형식은 PNG 유지 — 이진 이미지는 JPEG보다 PNG가 더 작고 깨끗하다)
- `MonoResult.dataUrl`은 호출부에서 쓰지 않아 생성하지 않는다(모바일 메모리 절약)
- 노트 페이지·라우트 양쪽에 4MB 상한 검사와 안내 문구 추가

### 이미지 분석 (`/api/openai-vision`)

현재 **클라이언트 호출부가 없는 미사용 엔드포인트**다. 상한만 4MB로 맞추고
`maxDuration`을 60초로 낮췄다(아래 참조). 다시 사용할 때는 SnapWord처럼
업로드 전 축소를 적용할 것.

### 그 외

- **실행시간**: `openai-vision` 120초 → **60초**. Hobby 플랜 상한이 60초라
  그대로 두면 배포가 거부된다. `upload-image`·`chat/messages`에 60초 명시
- **리전**: `vercel.json`에 `"regions": ["icn1"]` (서울)
- **Cloudways 워크플로 중단**: `workflow_dispatch` 전용으로 변경

### 변경하지 않은 것

- `lib/db.ts` — 이미 전역 커넥션 캐시 + `bufferCommands: false`로 서버리스에 적합
- 모든 API 라우트에 `runtime = "nodejs"`가 이미 선언되어 있음
- `next.config.ts`의 `experimental.serverActions.bodySizeLimit: "20mb"` —
  이 프로젝트에 서버 액션이 없어 쓰이지 않는다. Vercel에서는 플랫폼 한도가
  우선하므로 이 값에는 효력이 없다
- **R2 CORS 설정 불필요** — 업로드가 여전히 서버를 경유하므로 브라우저가 R2에
  직접 접근하지 않는다. (ignite처럼 사전 서명 방식으로 바꾸면 CORS가 필요해진다)

## 2. Vercel 프로젝트 설정

1. **Import**: Vercel → Add New → Project → `2xteam/snapnote`
   - ⚠️ **이 저장소의 기본 브랜치는 `main`이 아니라 `master`다.**
     Vercel의 Production Branch가 `master`로 설정되었는지 확인할 것
     (Settings → Git → Production Branch)
2. **Node.js Version 22.x** (v22 미만은 `File` 글로벌이 없어 업로드가 502로 실패)
3. **Environment Variables** — ⚠️ **Deploy 누르기 전에** 전부 입력한다.
   나중에 추가하면 기존 배포에는 반영되지 않아 재배포가 필요하다.
   반드시 **프로젝트 Settings → Environment Variables**에 넣을 것
   (계정 공용 Environment Variables 페이지에 넣으면 프로젝트에 연결되지 않는다):

   ```
   MONGO_URI
   OPENAI_API_KEY
   OPENAI_MODEL
   OPENAI_VISION_MODEL
   NEXT_PUBLIC_COOKIE_DOMAIN     # .myjane.co.kr
   R2_ACCOUNT_ID
   R2_ACCESS_KEY_ID
   R2_SECRET_ACCESS_KEY
   R2_BUCKET_NAME                # snapnote-uploads
   R2_PUBLIC_URL
   SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS SMTP_FROM
   ```

   SMTP 값은 현재 `.env`에 없다. 메일 기능(PIN 찾기·문의)을 쓰려면 채워야 한다.
4. **Functions Region**: `vercel.json`으로 `icn1` 지정됨. 대시보드에서도 확인
5. **MongoDB Atlas** → Network Access에 `0.0.0.0/0` 추가.
   클러스터가 **Paused 상태면 먼저 Resume**해야 한다(SnapWord 이관 시 실제로 겪음).
   Cloudways IP 항목은 컷오버 완료 후 제거

## 3. 검증 (도메인 연결 전, `*.vercel.app`에서)

- [ ] 회원가입 / 로그인 / PIN 재설정
- [ ] **노트 이미지 추가** — 촬영 → 크롭 → 모노톤 → 저장. 고해상도 사진으로 확인
- [ ] 저장된 이미지가 R2 공개 URL로 잘 표시되는지, 확대(줌)해도 읽히는지
- [ ] 오답 항목 삭제 시 R2 오브젝트도 삭제되는지
- [ ] 폴더·휴지통, 챗, 통계, 인쇄
- [ ] 문의/메일 발송 (SMTP 설정 후)

## 4. DNS 컷오버 (가비아)

`snapnote` 서브도메인만 교체한다. **`@`(apex)·`www`·`snapword` 레코드는 건드리지 않는다.**

**Vercel**: Settings → Domains에 `snapnote.myjane.co.kr` 추가 → 표시되는 CNAME 값 복사

**가비아**: My가비아 → 서비스관리 → 도메인 → `myjane.co.kr` → DNS 정보 → DNS 관리

| 작업 | 호스트 | 타입 | 값 | TTL |
|---|---|---|---|---|
| 삭제 | `snapnote` | A | `165.22.247.25` | - |
| 추가 | `snapnote` | CNAME | Vercel이 안내하는 값 (끝 마침표 포함) | 600 |

- 호스트에는 `snapnote`만 입력한다(전체 도메인을 넣으면 중복된다)
- 같은 호스트에 A와 CNAME은 공존할 수 없다 → A를 먼저 삭제해야 저장된다
- 저장 후 Vercel Domains에서 **Refresh**를 눌러야 검증·인증서 발급이 빨라진다

**확인**:

```bash
nslookup -type=CNAME snapnote.myjane.co.kr 8.8.8.8
curl.exe -sSI https://snapnote.myjane.co.kr/
```

`Server: Vercel` + `x-vercel-id: icn1::...` 이면 전환 완료.

## 5. 컷오버 후 재확인

도메인이 붙으면 `NEXT_PUBLIC_COOKIE_DOMAIN=.myjane.co.kr`이 실제로 적용된다
(vercel.app에서는 호스트가 맞지 않아 생략되던 값). **로그인·세션 유지를 한 번 더 확인**할 것.
SnapWord와 쿠키 도메인을 공유하므로 앱 전환(TopNav의 app switcher) 동작도 함께 확인한다.

## 6. Cloudways 정리 (컷오버 1~2주 후)

**서버는 삭제하지 않는다** — apex 사이트가 사용 중이다. SnapNote 앱만 정리한다.

- [ ] Cloudways에서 SnapNote 앱 정지 → 이상 없으면 삭제
- [ ] Domain Management에서 `snapnote.myjane.co.kr` 매핑 제거
- [ ] MongoDB Atlas Network Access에서 Cloudways IP 제거
- [ ] GitHub Secrets `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` / `DEPLOY_PATH` 삭제
- [ ] `.github/workflows/deploy-cloudways.yml`, `ecosystem.config.cjs` 삭제 검토

## 롤백

가비아에서 `snapnote`를 CNAME 삭제 → A `165.22.247.25` 복원(TTL 600이면 10분 내).

⚠️ **2026-09-01 시점 `snapnote.myjane.co.kr`은 503으로 다운 상태였다**(PM2 프로세스
미응답). 롤백 대상이 죽어 있으므로, 컷오버 전에 `*.vercel.app`에서 충분히 검증하거나
Cloudways 앱을 미리 되살려 둘 것.
