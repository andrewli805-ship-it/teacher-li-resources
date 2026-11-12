# Freenotes

Freenotes 是給 iPad 與 iPhone 使用的手寫筆記應用程式（PWA）。可在空白筆記本上用 Apple Pencil 或手指書寫，也可以匯入 PDF、Word 或 Excel，在文件上標註。資料只存在這部裝置的瀏覽器（IndexedDB），沒有登入、雲端或追蹤。

應用程式介面為繁體中文，名稱維持 **Freenotes**。電腦瀏覽器可用來測試，但第一版的目標裝置是 iPad 與 iPhone。

## 本機執行

需要 Node.js 18 或更新版本。

```bash
cd freenotes
npm install
npm run dev
```

開發伺服器預設在 `http://localhost:5173`。以手機或平板測試時，請用同一區網的位址開啟（Vite 啟動時會顯示 Network URL）。

正式建置：

```bash
npm run build
npm run preview
```

`npm run preview` 可用來檢查正式建置與離線快取。單元測試：

```bash
npm test
```

## 加到 iPhone / iPad 主畫面

書庫 tagline 下方的按鈕不會在 iPhone 或 iPad 上直接安裝，只開啟圖解。必須從主畫面圖示打開，才會全螢幕。

1. 用 **Safari** 開啟網站（開發時用電腦的區網位址，或之後自行部署的網址）。
2. iPhone：底部列沒有獨立分享圖示。點右下角「⋯」，再選「分享」或「加到主畫面」。iPad：點頂部工具列的分享按鈕。
3. 名稱確認為 Freenotes 後加入。

Android 若已收到瀏覽器的安裝事件，同一個按鈕會叫出系統提示，不會自動跳出。已用主畫面圖示開啟時，按鈕與說明會隱藏。

加到主畫面後，應用程式會以全螢幕（獨立視窗）開啟，並避開瀏海與主畫面指示器的安全區域。第一次成功載入後，應用程式外殼與已儲存的筆記可離線使用。

繪圖與匯入功能需要在本機或 HTTPS 環境執行；部分瀏覽器在不安全的網址下會限制 PWA 與檔案功能。

## 第一版功能

- 書庫：建立、重新命名、刪除筆記本；顯示更新時間與封面顏色
- 空白筆記本，紙張樣式：空白、橫線、方格
- 匯入 PDF（逐頁渲染並可在上面書寫）
- 匯入 Word（.docx，轉成預覽頁後可書寫）與 Excel（.xls / .xlsx，每個工作表為一頁或分段頁）
- 多頁瀏覽、新增頁、刪除頁、以縮圖調整頁序
- 原子筆、半透明螢光筆、筆劃橡皮擦
- 預設色盤與自訂顏色、筆劃粗細、復原／重做、清除本頁（需確認）
- 觸控筆壓力（若裝置提供）、書寫時忽略手掌觸碰（觸控筆書寫中會忽略手指）
- 雙指平移／縮放；單指或觸控筆用來書寫
- 筆跡以向量儲存，放大後仍保持清晰
- 匯出本頁 PNG，或本頁／整本 PDF

## 第一版限制

- 沒有雲端同步或帳號。清除 Safari 網站資料會一併刪除筆記本。
- 舊版 Word（`.doc`）不支援，請先另存為 `.docx`。Word 與 Excel 只做預覽與手寫標註，不會修改原始檔內容，也不是完整的文書或試算表編輯器。
- Excel 欄列很多時，工作表可能分成多頁預覽；版面是簡化表格，不是 Excel 的完整格式。
- 匯出 Word／Excel 頁面時，背景是以畫面轉圖方式產生，複雜排版或特殊字型可能與電腦上的原檔略有出入。
- 筆記只存在這部裝置的瀏覽器。清除網站資料會一併刪除。

## 放在資源站

`npm run build` 輸出到 `../apps/freenotes/`。Vite `base`、manifest `start_url` 與 service worker `scope` 都是 `/teacher-li-resources/apps/freenotes/`，所以不會攔截功課或展覽館頁面。公開網址要帶結尾斜線：`https://andrewli805-ship-it.github.io/teacher-li-resources/apps/freenotes/`。

書庫有「返回程式區」（連到 `apps/index.html`）和加到主畫面的說明按鈕。編輯頁沒有這個按鈕，只保留「返回書庫」。
