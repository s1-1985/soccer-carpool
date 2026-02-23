# 🤖 AI Assistant Core Instructions (Claude & Gemini 共通絶対ルール)

**【重要】AIエージェントはこのファイルを読み込んだ際、以下のルールを必ず遵守すること。**

1. **作業の透明性:** タスクの区切り（機能の完成、バグの特定、別AIへの交代時、またはリミット警告時）には、必ずこの `ai-handoff.md` ファイルの「現在の状態」「直近の課題」「次のステップ」を最新の情報に上書き更新すること。
2. **コマンドの明記:** 人間に実行を求めるGitコマンドやデプロイコマンドがある場合は、そのままコピペできる形式（コードブロック）で「次のステップ」に記載すること。
3. **継続性の担保:** 前のAI（ClaudeまたはGemini）が残した「直近の課題」から優先的に着手し、文脈を無視した大規模なリファクタリング（例：勝手なDB変更など）は行わないこと。

---

# AI Handoff Log

## 現在の状態（2026-02-23 更新）
- **Geminiによるバグ修正完了:**
    - `hub/index.html` から不要な `<nav class="main-nav">` を削除（ダブルタブ問題の解決）
    - `js/carpool/assignment.js` の第2IIFEの閉じカッコ `})(window.FCOjima);` を追加（SyntaxError修正）
- **currentブランチ:** `claude-fix-latest`
- **デザイン:** 山吹色(#E8A200)×黒(#1C1600)テーマは正常に適用済み

## 直近の課題
- Geminiが壊した他の箇所がある可能性（ユーザーより「色々おかしくしてしまった部分が有る」との情報）
- ダブルタブと SyntaxError 以外の問題は未調査

## 次のステップ
1. **ブラウザで動作確認:**
   - `http://localhost:5000/hub/index.html` → ナビが1段のみになっているか
   - `http://localhost:5000/carpool/assignments.html` → SyntaxErrorが解消されているか
2. **他のGeminiによるバグを調査・修正**
3. **リモートリポジトリへのプッシュ:**

```bash
git add -A
git commit -m "fix: Geminiバグ修正（ダブルタブ・SyntaxError）"
git push origin claude-fix-latest
```
