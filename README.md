# 李順華老師資源分享網頁 / Teacher Li Shun Wah Resources

Static site (HTML/CSS/JS). GitHub Pages serves this repository from the root of `main`.

## Preview locally

```bash
python3 -m http.server 8765
```

Then open: http://127.0.0.1:8765/

## Structure

- `index.html` — homepage
- `homework/` — hub + ICT / DT / Science
  - `homework/ict.html` — ICT 交功課（功課繳交 / HW Submission）、2627 2D／2H 入口、大埔三育中學連結
  - `homework/ai-game-2d.html`, `homework/ai-game-2h.html` — AI 小遊戲作品展覽館
  - `homework/ai-game.js` — 展覽館共用程式
- `resources/` — hub + ICT / DT / Science skeletons
- `apps/` — hub + Tinkercad / Python / GeoGebra
- `css/styles.css`, `js/i18n.js`, `js/main.js`

## Language

Toggle 中文 | EN (top right). Choice saved in `localStorage` key `teacher-li-lang`.

The AI game showcase has its own 繁體中文 | English switch, saved in `ai_game_lang`. On a first visit it follows `teacher-li-lang` when that key is already set.

## AI game showcase storage

Submissions stay in the browser that created them:

- 2627 2D: `localStorage` key `ai_game_submissions_2d`
- 2627 2H: `localStorage` key `ai_game_submissions_2h`

This is the same limitation as the original Google Site embed. Another device or browser cannot see the list, and clearing site data deletes it. Export the Excel list from the browser that holds the submissions. The two classes do not share a key, so they do not overwrite each other.

## Homework portal (phase 1)

Signed-in homework lives at `homework/portal.html`. The homepage and the homework hub both link to it. The 2627 AI game showcase pages are unchanged and still keep their lists in this browser only.

Sign-in asks for a username, not an email. The static client maps it to a Supabase Auth email:

| Username typed | Auth email |
| --- | --- |
| `STUDENT` (any case) | `student@homework.local` |
| `TEACHER` (any case) | `teacher@homework.local` |
| any other provisioned username | lower-case username `@homework.local` |

`lower(username)@homework.local` is the only rule. The demo rows follow it. On the live project, profile `STUDENT` is a student in class `2D`, seat `1`, and profile `TEACHER` is a teacher. Passwords are stored only in Supabase Auth. They are not in this repository, and the first sign-in does not ask for a new password.

Roles are `student` and `teacher`. A teacher creates further accounts from 帳號管理 / Accounts. That calls the `provision-account` edge function, which holds the server key outside git. The browser only has the publishable key in `js/supabase-config.js`.

Each submit adds a `submission_versions` row. Students cannot update or delete versions. A teacher can soft-delete (and restore) from 全班檢視 / Class view. If `due_at` is in the past and late work is accepted, the database marks the version late. The screen shows that assignment's `late_score_factor` (seeded assignments use 0.8). If late work is not accepted, the insert is rejected. Times on the form are Hong Kong time.

SQL under `supabase/migrations/` mirrors project `juxxddgkownhkxuofdjl`. Do not reset that database. Turn off public sign-ups in the Supabase Auth settings so only teacher-provisioned accounts exist. A self-registered user has no profile and is signed out by the portal, but the Auth user would still be created if sign-ups stay open.

## Still to add

DT / Science homework links, subject resource URLs, and any preferred Python online IDE.
Do **not** put unpublished Google Sites *edit* links on the student-facing site.
