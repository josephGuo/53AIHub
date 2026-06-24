/**
 * Permission utility functions
 */
import { message } from 'antd'
import { useUserStore } from '@/stores/modules/user'
import { t } from '@/locales'

export interface AuthOptions {
  // 检测是不是登录
  checkLogin?: boolean
  // 检测是不是有权限
  checkVersion?: boolean
  // 需要的权限组ID
  groupIds?: number[]
  // 检测是不是内部用户
  checkInternal?: boolean
  // 通过检查后的回调
  onClick?: () => void
  // 检查失败的回调
  onFailed?: () => void
}

/**
 * 显示登录弹窗
 */
export const showLoginModal = (): void => {
  window.dispatchEvent(new CustomEvent('open-login-modal'))
}

/**
 * 显示升级弹窗
 */
export const showUpgradeModal = (): void => {
  window.dispatchEvent(new CustomEvent('open-upgrade-modal'))
}

/**
 * Check if user is logged in
 */
export function isLoggedIn(): boolean {
  return !!localStorage.getItem('access_token')
}

/**
 * 检查登录状态
 */
export const checkLoginStatus = (): boolean => {
  const isLogined = isLoggedIn()
  if (!isLogined) {
    showLoginModal()
    return false
  }
  return true
}

/**
 * 检查版本权限
 */
export const checkVersionPermission = (groupIds?: number[]): boolean => {
  if (!groupIds || groupIds.length === 0) return true

  const userStore = useUserStore.getState()
  const userGroupIds = userStore.info.group_ids || (userStore.info.group_id ? [userStore.info.group_id] : [])
  const isInternal = userStore.info.is_internal
  const hasPermission = Boolean(
    userGroupIds.length && groupIds.some((id) => userGroupIds.includes(id))
  )

  if (!hasPermission) {
    if (isInternal) {
      message.warning(t('authority.agent_not_permission'))
      return false
    }
    showUpgradeModal()
    return false
  }

  return true
}

/**
 * 检查内部用户权限
 */
export const checkInternalPermission = (): boolean => {
  const userStore = useUserStore.getState()
  const isInternal = userStore.info.is_internal
  if (isInternal) {
    return true
  }
  message.warning(t('authority.knowledge_not_permission'))
  return false
}

/**
 * 统一的认证检查函数
 * @param options 认证选项
 * @returns 是否通过认证
 */
export const checkPermission = (options: AuthOptions = {}): boolean => {
  const { groupIds, onClick, onFailed, checkInternal } = options

  // 检查登录状态
  if (!checkLoginStatus()) {
    onFailed?.()
    return false
  }

  // 检查版本权限
  if (!checkVersionPermission(groupIds)) {
    onFailed?.()
    return false
  }

  // 检查内部权限
  if (checkInternal && !checkInternalPermission()) {
    onFailed?.()
    return false
  }

  // 如果所有检查都通过，执行回调
  onClick?.()

  return true
}

/**
 * Get current user info from localStorage
 */
export function getCurrentUser(): any {
  const userInfo = localStorage.getItem('user_info')
  return userInfo ? JSON.parse(userInfo) : null
}

/**
 * Require authentication for a route
 */
export function requireAuth(redirectUrl?: string): boolean {
  if (!isLoggedIn()) {
    const event = new CustomEvent('open-login-modal', {
      detail: { redirectUrl }
    })
    window.dispatchEvent(event)
    return false
  }
  return true
}
