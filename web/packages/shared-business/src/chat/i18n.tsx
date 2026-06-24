import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from "react";
import { chatMessages } from "./locales";

export type Lang = "zh-cn" | "zh-tw" | "en" | "ja";

/** 前缀，避免覆盖主站翻译 */
const PREFIX = "_shared.";

/** 知识面板打开数据 */
export interface KnowledgePanelData {
  type: 'knowledge_search' | 'source_click' | 'scope_narrowing';
  files?: any[];
  source?: any;
}

/** 知识面板打开回调 */
export type OnOpenKnowledgePanel = (data: KnowledgePanelData) => boolean | void;

/** URL 配置 */
export interface ChatUrlConfig {
  /** 前台基础 URL，用于构建跨应用跳转链接 */
  frontUrl?: string;
  /** 自定义构建文档 URL 函数（优先级高于 frontUrl） */
  buildLibraryUrl?: (libraryId: string | number, fileId: string | number) => string;
}

interface ChatContextValue extends ChatUrlConfig {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** 知识面板打开回调 */
  onOpenKnowledgePanel?: OnOpenKnowledgePanel;
}

const ChatContext = createContext<ChatContextValue>({
  lang: "zh-cn",
  setLang: () => {},
  t: (key: string) => key,
});

const LANG_KEY = "agentplugin-lang";

function detectBrowserLanguage(): Lang {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("zh-tw") || browserLang.startsWith("zh-hant")) {
    return "zh-tw";
  }
  if (browserLang.startsWith("zh")) {
    return "zh-cn";
  }
  if (browserLang.startsWith("ja")) {
    return "ja";
  }
  if (browserLang.startsWith("en")) {
    return "en";
  }
  return "zh-cn";
}

export interface ChatConfigProviderProps {
  lang?: Lang;
  frontUrl?: string;
  buildLibraryUrl?: (libraryId: string | number, fileId: string | number) => string;
  /**
   * 知识面板打开回调
   *
   * **前台场景**: 传入打开侧边栏逻辑，展示知识检索详情
   * - type='knowledge_search': 打开 ThinkKnowledge 侧边栏
   * - type='source_click': 打开侧边栏并选中对应文件
   * - type='scope_narrowing': 打开侧边栏并选中对应知识库
   *
   * **后台场景**: 传入跳转前台逻辑
   * - type='knowledge_search'/'source_click': 跳转前台文档详情页
   * - type='scope_narrowing': 跳转前台知识库首页
   *
   * 返回 true 表示已处理，返回 false 则使用默认行为（相对路径跳转，仅前台适用）
   */
  onOpenKnowledgePanel?: OnOpenKnowledgePanel;
  children: ReactNode;
}

export function ChatConfigProvider({
  lang: langProp,
  frontUrl,
  buildLibraryUrl,
  onOpenKnowledgePanel,
  children,
}: ChatConfigProviderProps) {
  const [lang, setLangState] = useState<Lang>(() => {
    // Priority: prop > localStorage > browser language > default
    if (langProp) {
      return langProp as Lang;
    }
    const stored = localStorage.getItem(LANG_KEY) as Lang | null;
    if (stored) {
      return stored;
    }
    return detectBrowserLanguage();
  });

  // 同步外部 prop 变化
  useEffect(() => {
    if (langProp && langProp !== lang) {
      setLangState(langProp as Lang);
    }
  }, [langProp, lang]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem(LANG_KEY, newLang);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const messages = chatMessages[lang] || chatMessages["zh-cn"];
    // 自动添加前缀
    const fullKey = PREFIX + key;
    const parts = fullKey.split(".");
    let result: any = messages;
    for (const part of parts) {
      if (result && typeof result === "object" && part in result) {
        result = result[part];
      } else {
        return key;
      }
    }
    let text = typeof result === "string" ? result : key;

    // 处理插值 {{param}}
    if (params && typeof text === "string") {
      text = text.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => {
        return params[paramKey] !== undefined ? String(params[paramKey]) : `{{${paramKey}}}`;
      });
    }

    return text;
  }, [lang]);

  return (
    <ChatContext.Provider value={{ lang, setLang, t, frontUrl, buildLibraryUrl, onOpenKnowledgePanel }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useTranslation() {
  return useContext(ChatContext);
}

/** 获取 URL 配置 */
export function useChatConfig(): ChatUrlConfig {
  const { frontUrl, buildLibraryUrl } = useContext(ChatContext);
  return { frontUrl, buildLibraryUrl };
}

/** 获取知识面板回调 */
export function useKnowledgePanel(): OnOpenKnowledgePanel | undefined {
  return useContext(ChatContext).onOpenKnowledgePanel;
}

/** 构建 library URL 的工具函数 */
export function buildLibraryUrl(
  config: ChatUrlConfig,
  libraryId: string | number | undefined | null,
  fileId: string | number | undefined | null
): string | null {
  if (!libraryId || !fileId) return null;

  // 优先使用自定义函数
  if (config.buildLibraryUrl) {
    return config.buildLibraryUrl(libraryId, fileId);
  }

  // 使用 frontUrl 前缀
  if (config.frontUrl) {
    return `${config.frontUrl}/library/${libraryId}/file/${fileId}`;
  }

  // 默认相对路径（前台应用）
  return `/library/${libraryId}/file/${fileId}`;
}
