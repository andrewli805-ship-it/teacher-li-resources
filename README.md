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
  - `homework/ict.html` — ICT 交功課（功課繳交 / HW Submission）、2627 2D／2H 提交入口、大埔三育中學連結
  - `homework/ai-game-2d.html`, `homework/ai-game-2h.html` — 登入後提交／老師管理
  - `homework/ai-game.js` — 提交與管理
- `gallery/` — 公眾展覽目錄
  - `gallery/ict-2627-2d/`, `gallery/ict-2627-2h/` — 只讀作品牆
- `js/gallery-wall.js` — 公眾牆（只讀 Supabase）
- `resources/` — hub + ICT / DT / Science skeletons
- `apps/` — hub + Tinkercad / Python / GeoGebra
- `css/styles.css`, `js/i18n.js`, `js/main.js`

## Language

Toggle 中文 | EN (top right). Choice saved in `localStorage` key `teacher-li-lang`.

## AI mini-game exhibition

Public walls list submitted works from Supabase. They do not use `localStorage`, and they do not show empty seats.

`homework/ai-game-2d.html` and `homework/ai-game-2h.html` are the signed-in pages. Guests are sent to `homework/portal.html?next=`. An active student can submit for classmates (year, class, student number, name, http(s) URL). The same year + class + student number updates that row. An active teacher sets the due time, late policy, edits rows, and exports CSV.

Due dates stay on the class assignments marked `kind = ai_game` (one for 2D, one for 2H). Rows are in `ai_game_entries`. SQL: `supabase/migrations/20261103130128_ai_game_entries.sql`. That file is already applied on project `juxxddgkownhkxuofdjl`. Do not reset the database and do not re-apply it.

帳號 Student／TEACHER，密碼另發。`Student` is the same sign-in as `STUDENT`.

## Who can do what

No sign-in is required to browse the home page, subject resources, app notes, or the public exhibition walls. Playing a submitted game stays public. Login does not block the gallery.

Sign-in is required to submit AI mini-game links, to submit versioned homework, to see your own version history, and for teacher tools. The header control is **登入 Login**. After sign-in it shows the username and **登出**. `next` on the portal is only a same-site return path. After login, `next` pointing at `homework/ai-game-*.html` returns there.

## Homework portal (phase 1)

Signed-in homework lives at `homework/portal.html`. The homepage and the homework hub both link to it. The public AI mini-game walls stay open without sign-in. Portal assignment lists skip `kind = ai_game`; those due dates are edited on the class submit pages.

Sign-in asks for a username, not an email. The static client maps it to a Supabase Auth email:

| Username typed | Auth email |
| --- | --- |
| `STUDENT` (any case) | `student@homework.local` |
| `TEACHER` (any case) | `teacher@homework.local` |
| any other provisioned username | lower-case username `@homework.local` |

`lower(username)@homework.local` is the only rule. The login form stays a username field; the mapping lives in `js/homework-portal.js`. Confirm email is disabled on the live project (`mailer_autoconfirm`), so sign-in does not wait for a confirmation message.

These profiles already exist in project `juxxddgkownhkxuofdjl`. This pull request does not create Auth users:

| Username | Auth email | Role | Profile | Auth user id |
| --- | --- | --- | --- | --- |
| `STUDENT` | `student@homework.local` | student | class `2D`, seat `12` | `b81d5de7-008c-4bd9-bcde-a9bbbcccbe7a` |
| `TEACHER` | `teacher@homework.local` | teacher | no class | `1bfd84c0-bcf8-4947-92d3-02e8658d2961` |

Passwords are stored only in Supabase Auth. They are not in this repository, and the first sign-in does not ask for a new password.

Roles are `student` and `teacher`. A teacher creates further accounts from 帳號管理 / Accounts. That calls the `provision-account` edge function, which holds the server key outside git. The browser only has the publishable key in `js/supabase-config.js`.

Each submit adds a `submission_versions` row. Students cannot update or delete versions. A teacher can soft-delete (and restore) from 全班檢視 / Class view. If `due_at` is in the past and late work is accepted, the database marks the version late. The screen shows that assignment's `late_score_factor` (seeded assignments use 0.8). If late work is not accepted, the insert is rejected. Times on the form are Hong Kong time.

SQL under `supabase/migrations/` mirrors project `juxxddgkownhkxuofdjl`. Do not reset that database. Turn off public sign-ups in the Supabase Auth settings so only teacher-provisioned accounts exist. A self-registered user has no profile and is signed out by the portal, but the Auth user would still be created if sign-ups stay open.

## Still to add

DT / Science homework links, subject resource URLs, and any preferred Python online IDE.
Do **not** put unpublished Google Sites *edit* links on the student-facing site.
