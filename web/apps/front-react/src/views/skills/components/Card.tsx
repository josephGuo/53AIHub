import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreOutlined, DeleteOutlined } from '@ant-design/icons'
import { Button, Switch, Tag, Tooltip, message, Modal } from 'antd'
import { Dropdown } from '@km/shared-components-react'
import type { MenuProps } from 'antd'
import { SvgIcon } from '@km/shared-components-react'
import { StarRating } from '@/components/StarRating'
import { useSkillsStore } from '@/stores/modules/skills'
import { useIsSoftStyle } from '@/stores/modules/enterprise'
import { skillApi } from '@/api/modules/skill'
import { calculateAverageScore } from '@/api/modules/skill/transform'
import type { Skill } from '@/api/modules/skill/types'
import { t } from '@/locales'
import { checkPermission } from "@/utils/permission"

interface SkillCardProps {
  skill: Skill
  type: 'explore' | 'my'
  groupId?: number
  onAdd?: (id: string) => void
  onOpenEnvSettings?: () => void
}

const SkillCard: React.FC<SkillCardProps> = ({ skill, type, groupId, onAdd, onOpenEnvSettings }) => {
  const navigate = useNavigate()
  const skillsStore = useSkillsStore()
  const isSoftStyle = useIsSoftStyle()

  const isEnabled = skill.binding_status === 'enabled'

  const groupNames = useMemo(() => {
    // 如果选择了特定分组，只显示该分组名
    if (groupId && groupId !== 0) {
      const group = skillsStore.categorys.find(c => c.group_id === groupId)
      return group?.group_name ? [group.group_name] : []
    }
    // 如果选择"全部"，显示技能所属的所有分组名
    return skillsStore.categorys
      .filter(c => skill.group_ids?.includes(c.group_id))
      .map(c => c.group_name)
  }, [groupId, skill.group_ids, skillsStore.categorys])

  const rating = useMemo(() => calculateAverageScore(skill), [skill])

  const handleClick = () => {
    const params = new URLSearchParams()
    params.set('type', type)
    if (groupId && groupId > 0) {
      params.set('group_id', String(groupId))
    }
    navigate(`/skills/${skill.id}?${params.toString()}`)
  }

  const handleToggle = async (checked: boolean) => {
    const newStatus = checked ? 'enabled' : 'disabled'
    const bindingId = skill.binding_id

    if (!bindingId) {
      message.error(t('skill.binding_id_not_found'))
      return
    }

    try {
      await skillApi.updateMySkillStatus(bindingId, { status: newStatus })
      await skillsStore.loadMySkillList(true, true)
      await skillsStore.loadSkillList({ isRefresh: true })
    } catch (error) {
      skill.binding_status = checked ? 'disabled' : 'enabled'
      message.error(`${t('action.operation_failed')}，${t('common.try_again')}`)
    }
  }

  const handleAdd = async () => {
    if (skill.added) return
    checkPermission({
      groupIds: skill?.group_ids || [],
      onClick: async () => {
        try {
          await skillApi.addToMy(skill.id)
          await skillsStore.loadSkillList({ isRefresh: true, group_id: groupId || undefined })
          await skillsStore.loadMySkillList(true)
          message.success(t('action.add_success'))
          onAdd?.(skill.id)
        } catch (error) {
          message.error(`${t('action.operation_failed')}，${t('common.try_again')}`)
        }
      }
    })
  }

  const handleUse = () => {
    if (!isSoftStyle) {
      message.warning(t('skill.soft_mode_only'))
      return
    }
    if (!isEnabled) {
      message.warning(t('skill.enable_first'))
      return
    }

    navigate({
      pathname: '/index/chat',
      search: `?skill_id=${skill.id}&type=${type}`
    })
  }

  const handleOpenEnvSettings = (e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenEnvSettings?.()
  }

  const handleCommand = async (command: string) => {
    if (command === 'delete') {
      Modal.confirm({
        title: t('common.tip'),
        content: t('action.delete_confirm'),
        okType: 'danger',
        onOk: async () => {
          await skillApi.deleteMySkill(skill.binding_id)
          message.success(t('status.delete_success'))
          await skillsStore.loadMySkillList(true)
          await skillsStore.loadSkillList({ isRefresh: true })
        }
      })
    }
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'delete',
      label: (
        <div className="flex items-center text-red-500">
          <DeleteOutlined className="mr-2" />
          {t('action.delete')}
        </div>
      )
    }
  ]

  const isDisabled = skill.admin_status === 'disabled'
  const isGrayscale = type === 'my' && !isEnabled

  return (
    <Tooltip title={isDisabled ? t('skill.disabled_by_admin') : ''} placement="top">
      <div
        className={`bg-white border border-[#E6E6E6] rounded-lg p-5 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col h-full relative ${isDisabled ? 'cursor-not-allowed' : ''}`}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          <img
            className="flex-none size-12 rounded-lg object-cover"
            src={skill.logo}
            alt={skill.display_name}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex items-center gap-2 overflow-hidden">
                <h3
                  className={`text-base font-medium text-gray-900 truncate transition-all ${isGrayscale ? 'grayscale opacity-60' : ''}`}
                >
                  {skill.display_name}
                </h3>
                <Tag className="shrink-0 text-xs rounded-3xl truncate max-w-[80px]" title={skill.version}>{skill.version}</Tag>
              </div>

              {type === 'my' && (
                <Switch
                  checked={isEnabled}
                  disabled={isDisabled}
                  onClick={(_, e) => e.stopPropagation()}
                  onChange={handleToggle}
                />
              )}
            </div>
            {/* 多分组 */}
            {groupNames.length > 0 && groupNames.map((name, index) => (
              <span
                key={index}
                className="h-5 inline-flex items-center px-2 text-xs text-theme bg-[#EBF1FF] rounded-sm mr-1"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        <p
          className={`text-sm text-placeholder line-clamp-2 my-2 flex-1 leading-relaxed transition-all ${isGrayscale ? 'grayscale opacity-60' : ''}`}
        >
          {skill.description}
        </p>

        {type === 'explore' && (
          <div
            className={`flex items-center justify-between transition-all ${isGrayscale ? 'grayscale opacity-60' : ''}`}
          >
            <div className="flex items-center">
              <StarRating value={rating} gap="sm" />
            </div>

            <Button
              disabled={skill.added}
              className={`${skill.added ? 'opacity-60' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleAdd()
              }}
            >
              {skill.added ? t('action.add_success') : t('action.add')}
            </Button>
          </div>
        )}

        {type === 'my' && (
          <div className="flex items-center gap-2 border-t border-gray-50 mt-auto">
            <Button
              disabled={isDisabled}
              onClick={(e) => {
                e.stopPropagation()
                handleUse()
              }}
              className="flex-1"
            >
              {t('skill.workbench_use')}
            </Button>

            <Button
              disabled={isDisabled}
              onClick={handleOpenEnvSettings}
              className="!p-2"
              aria-label="环境变量设置"
              title="环境变量设置"
            >
              <SvgIcon name="env" size={16} color="#1D1E1F" />
            </Button>

            <div onClick={(e) => e.stopPropagation()}>
              <Dropdown
                disabled={isDisabled}
                trigger={['click']}
                menu={{ items: menuItems, onClick: (e) => handleCommand(e.key) }}
                placement="bottomRight"
              >
                <Button
                  disabled={isDisabled}
                  className="!p-2"
                >
                  <MoreOutlined className="rotate-90" />
                </Button>
              </Dropdown>
            </div>
          </div>
        )}

      </div>
    </Tooltip>
  )
}

export default SkillCard
