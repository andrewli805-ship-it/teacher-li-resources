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

## Still to add

DT / Science homework links, subject resource URLs, and any preferred Python online IDE.
Do **not** put unpublished Google Sites *edit* links on the student-facing site.
