/**
 * FC尾島ジュニア - 強制CSS修正スクリプト完全版
 * 
 * 機能:
 * - バックアップ作成
 * - CSS修正（!important適用）
 * - public フォルダへの同期
 * - HTML への直接 <style> タグ挿入
 * - 実行ログの出力
 * 
 * 使用方法:
 * node force-css-fix-script.js
 * 
 * 作成日: 2025-07-07
 * 対象: FC尾島ジュニアプロジェクト
 */

const fs = require('fs');
const path = require('path');

// 設定
const CONFIG = {
    projectRoot: __dirname,
    cssDir: path.join(__dirname, 'css'),
    publicCssDir: path.join(__dirname, 'public', 'css'),
    htmlDirs: [
        __dirname,
        path.join(__dirname, 'auth'),
        path.join(__dirname, 'hub'),
        path.join(__dirname, 'carpool'),
        path.join(__dirname, 'public'),
        path.join(__dirname, 'public', 'auth'),
        path.join(__dirname, 'public', 'hub'),
        path.join(__dirname, 'public', 'carpool')
    ],
    backupSuffix: '.backup',
    logFile: path.join(__dirname, 'css-fix-log.txt')
};

// ログ記録システム
class Logger {
    constructor() {
        this.logs = [];
        this.startTime = new Date();
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${type}: ${message}`;
        console.log(logEntry);
        this.logs.push(logEntry);
    }

    error(message) {
        this.log(message, 'ERROR');
    }

    success(message) {
        this.log(message, 'SUCCESS');
    }

    warning(message) {
        this.log(message, 'WARNING');
    }

    saveToFile() {
        const logContent = [
            '=== FC尾島ジュニア - 強制CSS修正スクリプト完全版 実行ログ ===',
            `実行開始: ${this.startTime.toISOString()}`,
            `実行終了: ${new Date().toISOString()}`,
            '=================================================',
            '',
            ...this.logs,
            '',
            '=== 実行完了 ==='
        ].join('\n');

        try {
            fs.writeFileSync(CONFIG.logFile, logContent, 'utf8');
            console.log(`ログファイルを保存しました: ${CONFIG.logFile}`);
        } catch (error) {
            console.error('ログファイルの保存に失敗しました:', error.message);
        }
    }
}

// CSS修正プロセッサー
class CSSProcessor {
    constructor(logger) {
        this.logger = logger;
        this.modificationCount = 0;
    }

    // CSS ファイルに !important を追加
    processCSS(cssContent) {
        this.logger.log('CSS修正処理を開始...');
        
        // 既に !important が付いているプロパティは除外
        const cssRules = cssContent.split('}');
        let modifiedCSS = '';
        
        for (const rule of cssRules) {
            if (rule.trim() === '') continue;
            
            const [selector, ...declarations] = rule.split('{');
            if (declarations.length === 0) {
                modifiedCSS += rule + '}';
                continue;
            }
            
            const declarationBlock = declarations.join('{');
            const properties = declarationBlock.split(';');
            const modifiedProperties = [];
            
            for (const property of properties) {
                if (property.trim() === '') continue;
                
                // 既に !important が付いている場合はスキップ
                if (property.includes('!important')) {
                    modifiedProperties.push(property);
                    continue;
                }
                
                // コメントの場合はスキップ
                if (property.trim().startsWith('/*')) {
                    modifiedProperties.push(property);
                    continue;
                }
                
                // プロパティに !important を追加
                if (property.includes(':')) {
                    const trimmedProperty = property.trim();
                    modifiedProperties.push(trimmedProperty + ' !important');
                    this.modificationCount++;
                }
            }
            
            modifiedCSS += selector + '{' + modifiedProperties.join(';') + '}';
        }
        
        return modifiedCSS;
    }

    // 特定のセレクターに対する強制CSS
    getForceCSS() {
        return `
/* 強制CSS修正スクリプト完全版 - 自動追加 */
/* 実行日時: ${new Date().toISOString()} */

/* ナビゲーション強制修正 */
.main-nav ul {
    list-style: none !important;
    display: flex !important;
    flex-direction: row !important;
    padding: 0 !important;
    margin: 0 !important;
    flex-wrap: wrap !important;
}

.main-nav {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    background: rgba(255, 255, 255, 0.95) !important;
    border-radius: 12px !important;
    margin-bottom: 30px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
    backdrop-filter: blur(10px) !important;
    border: 2px solid rgba(255, 215, 0, 0.3) !important;
}

.main-nav li {
    flex: 1 !important;
    min-width: 120px !important;
}

.main-nav a {
    display: block !important;
    padding: 15px 20px !important;
    text-decoration: none !important;
    color: #333 !important;
    font-weight: 500 !important;
    text-align: center !important;
    transition: all 0.3s ease !important;
    border-radius: 8px !important;
    margin: 5px !important;
}

.main-nav a:hover {
    background: linear-gradient(135deg, #FFD700, #FFA500) !important;
    color: #1a1a1a !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3) !important;
}

.main-nav a.active {
    background: linear-gradient(135deg, #FFD700, #FFA500) !important;
    color: #1a1a1a !important;
    font-weight: 600 !important;
}

/* レスポンシブ対応 */
@media screen and (max-width: 768px) {
    .main-nav ul {
        flex-direction: column !important;
    }
    
    .main-nav {
        flex-direction: column !important;
    }
    
    .main-nav li {
        min-width: auto !important;
    }
}

@media screen and (max-width: 414px) {
    .main-nav ul {
        flex-direction: column !important;
        gap: 2px !important;
    }
    
    .main-nav a {
        padding: 12px 16px !important;
        margin: 2px !important;
        font-size: 14px !important;
        border-radius: 6px !important;
    }
    
    .main-nav li {
        min-width: auto !important;
        flex: none !important;
    }
}

@media screen and (max-width: 480px) {
    .main-nav ul {
        flex-direction: column !important;
        gap: 1px !important;
    }
    
    .main-nav a {
        padding: 8px 12px !important;
        font-size: 12px !important;
        margin: 1px !important;
        min-height: 40px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    }
}

/* 強制CSS修正スクリプト完全版 - 終了 */
`;
    }
}

// ファイル操作ユーティリティ
class FileManager {
    constructor(logger) {
        this.logger = logger;
    }

    // ディレクトリ作成
    ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            this.logger.log(`ディレクトリを作成しました: ${dirPath}`);
        }
    }

    // ファイルをバックアップ
    backup(filePath) {
        const backupPath = filePath + CONFIG.backupSuffix;
        try {
            if (fs.existsSync(filePath)) {
                fs.copyFileSync(filePath, backupPath);
                this.logger.success(`バックアップを作成しました: ${backupPath}`);
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error(`バックアップ作成エラー: ${error.message}`);
            return false;
        }
    }

    // ファイルの読み取り
    readFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                this.logger.log(`ファイルを読み取りました: ${filePath}`);
                return content;
            }
            return null;
        } catch (error) {
            this.logger.error(`ファイル読み取りエラー: ${error.message}`);
            return null;
        }
    }

    // ファイルの書き込み
    writeFile(filePath, content) {
        try {
            fs.writeFileSync(filePath, content, 'utf8');
            this.logger.success(`ファイルを書き込みました: ${filePath}`);
            return true;
        } catch (error) {
            this.logger.error(`ファイル書き込みエラー: ${error.message}`);
            return false;
        }
    }

    // ディレクトリ内のファイル一覧を取得
    getFilesInDirectory(dirPath, extension = '.css') {
        try {
            if (!fs.existsSync(dirPath)) return [];
            
            const files = fs.readdirSync(dirPath);
            return files.filter(file => file.endsWith(extension));
        } catch (error) {
            this.logger.error(`ディレクトリ読み取りエラー: ${error.message}`);
            return [];
        }
    }

    // ファイルを別のディレクトリにコピー
    copyFile(sourcePath, targetPath) {
        try {
            this.ensureDirectory(path.dirname(targetPath));
            fs.copyFileSync(sourcePath, targetPath);
            this.logger.success(`ファイルをコピーしました: ${sourcePath} → ${targetPath}`);
            return true;
        } catch (error) {
            this.logger.error(`ファイルコピーエラー: ${error.message}`);
            return false;
        }
    }
}

// HTML操作ユーティリティ
class HTMLProcessor {
    constructor(logger) {
        this.logger = logger;
    }

    // HTMLファイルに<style>タグを挿入
    insertStyleTag(htmlContent, cssContent) {
        const styleTag = `<style>\n${cssContent}\n</style>`;
        
        // 既存の<style>タグを削除（重複を避ける）
        const cleanedHTML = htmlContent.replace(/<style>[\s\S]*?<\/style>/g, '');
        
        // <head>タグの直前に挿入
        if (cleanedHTML.includes('</head>')) {
            return cleanedHTML.replace('</head>', `${styleTag}\n</head>`);
        }
        
        // <head>タグがない場合は<html>タグの直後に挿入
        if (cleanedHTML.includes('<html>')) {
            return cleanedHTML.replace('<html>', `<html>\n<head>\n${styleTag}\n</head>`);
        }
        
        // どちらもない場合は先頭に挿入
        return `${styleTag}\n${cleanedHTML}`;
    }

    // HTMLファイルを処理
    processHTMLFile(filePath, cssContent) {
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        const modifiedHTML = this.insertStyleTag(htmlContent, cssContent);
        
        // バックアップを作成
        const backupPath = filePath + CONFIG.backupSuffix;
        fs.writeFileSync(backupPath, htmlContent, 'utf8');
        
        // 修正したHTMLを保存
        fs.writeFileSync(filePath, modifiedHTML, 'utf8');
        
        this.logger.success(`HTMLファイルを処理しました: ${filePath}`);
    }
}

// メイン実行クラス
class CSSFixScript {
    constructor() {
        this.logger = new Logger();
        this.fileManager = new FileManager(this.logger);
        this.cssProcessor = new CSSProcessor(this.logger);
        this.htmlProcessor = new HTMLProcessor(this.logger);
    }

    // スクリプトの実行
    async run() {
        this.logger.log('=== FC尾島ジュニア - 強制CSS修正スクリプト完全版 開始 ===');
        
        try {
            // 1. バックアップ作成
            await this.createBackups();
            
            // 2. CSS修正処理
            await this.processCSS();
            
            // 3. public フォルダへの同期
            await this.syncToPublic();
            
            // 4. HTML への直接 <style> タグ挿入
            await this.insertStylesInHTML();
            
            // 5. 実行ログの出力
            this.generateReport();
            
        } catch (error) {
            this.logger.error(`実行エラー: ${error.message}`);
            throw error;
        } finally {
            this.logger.saveToFile();
            this.logger.log('=== 強制CSS修正スクリプト完全版 完了 ===');
        }
    }

    // バックアップ作成
    async createBackups() {
        this.logger.log('バックアップ作成を開始...');
        
        // CSSファイルのバックアップ
        const cssFiles = this.fileManager.getFilesInDirectory(CONFIG.cssDir);
        for (const file of cssFiles) {
            if (!file.endsWith('.backup')) {
                const filePath = path.join(CONFIG.cssDir, file);
                this.fileManager.backup(filePath);
            }
        }
        
        // サブディレクトリのCSSファイルもバックアップ
        const subDirs = ['hub', 'carpool'];
        for (const subDir of subDirs) {
            const subDirPath = path.join(CONFIG.cssDir, subDir);
            if (fs.existsSync(subDirPath)) {
                const subFiles = this.fileManager.getFilesInDirectory(subDirPath);
                for (const file of subFiles) {
                    if (!file.endsWith('.backup')) {
                        const filePath = path.join(subDirPath, file);
                        this.fileManager.backup(filePath);
                    }
                }
            }
        }
        
        this.logger.success('バックアップ作成完了');
    }

    // CSS修正処理
    async processCSS() {
        this.logger.log('CSS修正処理を開始...');
        
        const commonCSSPath = path.join(CONFIG.cssDir, 'common.css');
        const cssContent = this.fileManager.readFile(commonCSSPath);
        
        if (cssContent) {
            // 強制CSSを追加
            const forceCSS = this.cssProcessor.getForceCSS();
            const modifiedCSS = cssContent + '\n' + forceCSS;
            
            // 修正したCSSを保存
            this.fileManager.writeFile(commonCSSPath, modifiedCSS);
            
            this.logger.success(`CSS修正完了: ${this.cssProcessor.modificationCount} 件のプロパティを修正`);
        } else {
            this.logger.warning('common.css が見つかりません');
        }
    }

    // public フォルダへの同期
    async syncToPublic() {
        this.logger.log('public フォルダへの同期を開始...');
        
        // public/css ディレクトリを確保
        this.fileManager.ensureDirectory(CONFIG.publicCssDir);
        
        // common.css を同期
        const commonCSSSource = path.join(CONFIG.cssDir, 'common.css');
        const commonCSSTarget = path.join(CONFIG.publicCssDir, 'common.css');
        this.fileManager.copyFile(commonCSSSource, commonCSSTarget);
        
        // サブディレクトリも同期
        const subDirs = ['hub', 'carpool'];
        for (const subDir of subDirs) {
            const sourceDirPath = path.join(CONFIG.cssDir, subDir);
            const targetDirPath = path.join(CONFIG.publicCssDir, subDir);
            
            if (fs.existsSync(sourceDirPath)) {
                this.fileManager.ensureDirectory(targetDirPath);
                const files = this.fileManager.getFilesInDirectory(sourceDirPath);
                
                for (const file of files) {
                    if (!file.endsWith('.backup')) {
                        const sourcePath = path.join(sourceDirPath, file);
                        const targetPath = path.join(targetDirPath, file);
                        this.fileManager.copyFile(sourcePath, targetPath);
                    }
                }
            }
        }
        
        this.logger.success('public フォルダへの同期完了');
    }

    // HTML への直接 <style> タグ挿入
    async insertStylesInHTML() {
        this.logger.log('HTML への <style> タグ挿入を開始...');
        
        const forceCSS = this.cssProcessor.getForceCSS();
        let processedCount = 0;
        
        for (const htmlDir of CONFIG.htmlDirs) {
            if (fs.existsSync(htmlDir)) {
                const htmlFiles = this.fileManager.getFilesInDirectory(htmlDir, '.html');
                
                for (const htmlFile of htmlFiles) {
                    const htmlPath = path.join(htmlDir, htmlFile);
                    try {
                        this.htmlProcessor.processHTMLFile(htmlPath, forceCSS);
                        processedCount++;
                    } catch (error) {
                        this.logger.error(`HTMLファイル処理エラー: ${htmlPath} - ${error.message}`);
                    }
                }
            }
        }
        
        this.logger.success(`HTML への <style> タグ挿入完了: ${processedCount} ファイル処理`);
    }

    // 実行レポート生成
    generateReport() {
        this.logger.log('=== 実行レポート ===');
        this.logger.log(`実行時間: ${new Date() - this.logger.startTime}ms`);
        this.logger.log(`CSS修正数: ${this.cssProcessor.modificationCount}`);
        this.logger.log(`処理されたログ数: ${this.logger.logs.length}`);
        this.logger.log('=================');
    }
}

// スクリプトの実行
if (require.main === module) {
    const script = new CSSFixScript();
    script.run().catch(error => {
        console.error('スクリプト実行エラー:', error);
        process.exit(1);
    });
}

module.exports = CSSFixScript;