import { create } from 'zustand'
import shortcutsApi from '@/api/modules/shortcuts'
import { checkPermission } from '@/utils/permission'
import { message } from 'antd'
import { t } from '@/locales'
import type { ShortcutItem, ShortcutType } from '@/api/modules/shortcuts/types'

interface ShortcutsState {
  shortcuts: ShortcutItem[]
  loading: boolean
  shortcutsByType: (type: ShortcutType) => ShortcutItem[]
  isShortcut: (type: ShortcutType, related_id: string) => boolean
  getShortcut: (type: ShortcutType, related_id: string) => ShortcutItem | undefined
  getShortcutRoute: (shortcut: {
    type: ShortcutType
    related_id: string
    url?: string
    related_info?: { library_id?: string }
  }) => string
  loadShortcuts: () => Promise<void>
  addShortcut: (type: ShortcutType, related_id: string) => Promise<ShortcutItem>
  removeShortcut: (type: ShortcutType, related_id: string) => Promise<void>
  toggleShortcut: (type: ShortcutType, related_id: string) => Promise<boolean>
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  shortcuts: [],
  loading: false,

  /**
   * 根据类型获取快捷方式列表
   */
  shortcutsByType: (type) => {
    return get().shortcuts.filter(item => item.type === type)
  },

  /**
   * 检查某个资源是否已添加快捷方式
   */
  isShortcut: (type, related_id) => {
    return get().shortcuts.some(
      item => item.type === type && (item.related_id === related_id || item.raw_related_id === parseInt(related_id))
    )
  },

  /**
   * 获取某个资源的快捷方式
   */
  getShortcut: (type, related_id) => {
    return get().shortcuts.find(
      item => item.type === type && (item.related_id === related_id || item.raw_related_id === parseInt(related_id))
    )
  },

  /**
   * 根据快捷方式获取跳转路由
   */
  getShortcutRoute: (shortcut) => {
    const { type, related_id, url, related_info } = shortcut
    switch (type) {
      case "agent":
        return `/agent/${related_id}`
      case "library":
        return `/library/${related_id}`
      case "file":
        return `/library/${related_info?.library_id || ""}/file/${related_id}`
      case "ai_link":
        return url || ""
      default:
        return "/"
    }
  },

  /**
   * 加载所有快捷方式
   */
  loadShortcuts: async () => {
    set({ loading: true })
    try {
      const response = await shortcutsApi.list()
      set({ shortcuts: response.shortcuts || [] })
    } catch (error) {
      console.error('加载快捷方式失败:', error)
      set({ shortcuts: [] })
    } finally {
      set({ loading: false })
    }
  },

  /**
   * 添加快捷方式
   */
  addShortcut: async (type, related_id) => {
    try {
      if (!checkPermission()) {
        throw new Error(t('authority.login_not_permission'))
      }
      const shortcut = await shortcutsApi.create({ type, related_id })
      // 如果列表中不存在，则添加
      const shortcuts = get().shortcuts
      if (!shortcuts.find(item => item.id === shortcut.id)) {
        set({ shortcuts: [...shortcuts, shortcut] })
      }
      message.success(t('action.add_success'))
      return shortcut
    } catch (error) {
      console.error('添加快捷方式失败:', error)
      throw error
    }
  },

  /**
   * 移除快捷方式
   */
  removeShortcut: async (type, related_id) => {
    try {
      const shortcut = get().getShortcut(type, related_id)
      if (!shortcut) {
        throw new Error('快捷方式不存在')
      }
      await shortcutsApi.remove(shortcut.id)
      set({ shortcuts: get().shortcuts.filter(item => item.id !== shortcut.id) })
      message.success(t('action.remove_success'))
    } catch (error) {
      console.error('移除快捷方式失败:', error)
      throw error
    }
  },

  /**
   * 切换快捷方式（如果存在则移除，不存在则添加）
   */
  toggleShortcut: async (type, related_id) => {
    const existing = get().getShortcut(type, related_id)
    if (existing) {
      await get().removeShortcut(type, related_id)
      return false
    } else {
      await get().addShortcut(type, related_id)
      return true
    }
  },
}))
