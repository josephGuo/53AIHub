import { create } from 'zustand'
import { cacheManager as cache } from '@km/shared-utils'
import groupApi from '@/api/modules/group'
import skillApi from '@/api/modules/skill'
import type { Skill } from '@/api/modules/skill/types'
import { GROUP_TYPE } from '@/constants/group'
import { t } from "@/locales"
import { api_host } from '@/utils/config'

const CACHE_KEYS = {
  SKILL_LIST: 'skill_list',
  MY_SKILL_LIST: 'my_skill_list',
  CATEGORY_LIST: 'skill_category_list'
} as const

interface SkillsState {
  categorys: { group_id: number; group_name: string }[]
  skillList: Skill[]
  mySkillList: Skill[]
  mySkillLoading: boolean
  loadSkillList: (params?: { keyword?: string; offset?: number; limit?: number; isRefresh?: boolean; group_id?: number }) => Promise<Skill[]>
  loadCategorys: () => Promise<void>
  loadMySkillList: (isRefresh?: boolean, silent?: boolean) => Promise<Skill[]>
  addSkill: (skill: Skill) => void
  removeSkill: (skillId: string) => void
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  categorys: [],
  skillList: [],
  mySkillList: [],
  mySkillLoading: false,

  loadSkillList: async (params) => {
    const { offset = 0, limit = 500, isRefresh, group_id, ...rest } = params || {}
    const fetchSkills = async () => {
      const res = await skillApi.explore({ offset, limit, group_id: group_id || undefined, ...rest })
      return (res.items || []).map(item => {
        item.logo = item.logo || `${ api_host }/api/images/prompt/logo.png`
        return item
      })
    }

    if (params?.keyword !== undefined || isRefresh) {
      const skills = await fetchSkills()
      set({ skillList: skills })
      cache.set(CACHE_KEYS.SKILL_LIST, skills)
      return skills
    }

    const skills = await cache.getOrFetch(CACHE_KEYS.SKILL_LIST, fetchSkills)
    set({ skillList: skills })
    return skills
  },

  loadCategorys: async () => {
    const fetchCategories = async () => {
      const data = await groupApi.current_list(GROUP_TYPE.SKILLS)
      return [{ group_id: 0, group_name: t('common.all') }].concat(data) as { group_id: number; group_name: string }[]
    }
    const categorys = await cache.getOrFetch(CACHE_KEYS.CATEGORY_LIST, fetchCategories)
    set({ categorys })
  },

  loadMySkillList: async (isRefresh = false, silent = false) => {
    if (!silent) {
      set({ mySkillLoading: true })
    }
    try {
      const fetchMySkills = async () => {
        const res = await skillApi.getMyList({ offset: 0, limit: 500 })
        return (res.items || []).map(item => {
        item.logo = item.logo || `${ api_host }/api/images/prompt/logo.png`
        return item
      })
      }

      if (isRefresh) {
        const mySkillList = await fetchMySkills()
        set({ mySkillList })
        cache.set(CACHE_KEYS.MY_SKILL_LIST, mySkillList)
        return mySkillList
      }

      const mySkillList = await cache.getOrFetch(CACHE_KEYS.MY_SKILL_LIST, fetchMySkills)
      set({ mySkillList })
      return mySkillList
    } finally {
      if (!silent) {
        set({ mySkillLoading: false })
      }
    }
  },

  addSkill: (skill) => {
    const { mySkillList, skillList } = get()
    const exists = mySkillList.some(s => s.id === skill.id)
    if (!exists) {
      set({ mySkillList: [...mySkillList, { ...skill, added: true, binding_status: 'enabled' }] })
    }
    const index = skillList.findIndex(s => s.id === skill.id)
    if (index !== -1) {
      const newSkillList = [...skillList]
      newSkillList[index] = { ...newSkillList[index], added: true }
      set({ skillList: newSkillList })
    }
    cache.delete(CACHE_KEYS.MY_SKILL_LIST)
  },

  removeSkill: (skillId) => {
    const { mySkillList, skillList } = get()
    set({ mySkillList: mySkillList.filter(s => s.id !== skillId) })
    const index = skillList.findIndex(s => s.id === skillId)
    if (index !== -1) {
      const newSkillList = [...skillList]
      newSkillList[index] = { ...newSkillList[index], added: false }
      set({ skillList: newSkillList })
    }
    cache.delete(CACHE_KEYS.MY_SKILL_LIST)
  }
}))
