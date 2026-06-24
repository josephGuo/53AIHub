import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { Search, Tabs } from '@km/shared-components-react'
import { useAgentStore } from '@/stores/modules/agent'
import { useIsSoftStyle } from '@/stores/modules/enterprise'
import { showLoginModal, isLoggedIn } from '@/utils/permission'
import AgentList from './AgentList'
import { t } from '@/locales'

interface GroupListProps {
  selectMode?: boolean
  flatMode?: boolean
}

export function GroupList({ selectMode = false, flatMode = false }: GroupListProps) {
  const [keyword, setKeyword] = useState('')
  const [groupId, setGroupId] = useState(0)

  // 新增：读取 URL 参数
  const [searchParams, setSearchParams] = useSearchParams()

  const agentStore = useAgentStore()
  const isSoftStyle = useIsSoftStyle()

  // 有缓存则静默刷新，无缓存则显示骨架屏
  const [loading, setLoading] = useState(!agentStore.agentList.length)

  useEffect(() => {
    if (agentStore.agentList.length === 0) {
      setLoading(true)
    }
    Promise.all([
      agentStore.loadCategorys(),
      agentStore.loadAgentList(),
    ]).finally(() => setLoading(false))
  }, [])

  // 新增：响应 URL 参数变化选中分组
  useEffect(() => {
    const groupIdParam = searchParams.get('group_id')
    if (groupIdParam) {
      const id = Number(groupIdParam)
      // 验证：必须是有效数字且 >= 0，且要么是 0（全部），要么存在于分组列表中
      if (!isNaN(id) && id >= 0) {
        const exists = id === 0 || agentStore.categorys.some(cat => cat.group_id === id)
        if (exists) {
          setGroupId(id)
        }
      }
    }
  }, [searchParams, agentStore.categorys])

  const showAgentList = useMemo(() => {
    const list = groupId === 0
      ? agentStore.agentList
      : agentStore.agentList.filter((item) => item.group_id === groupId)
    return list.filter((item) => item.user_group_ids?.length > 0)
  }, [agentStore.agentList, groupId])

  const tabItems = useMemo(() =>
    agentStore.categorys.map((cat) => ({
      key: String(cat.group_id),
      label: cat.group_name
    })),
    [agentStore.categorys]
  )

  const handleTabChange = (key: string) => {
    if (!isLoggedIn()) {
      showLoginModal()
    }
    setGroupId(Number(key))
    const newParams = new URLSearchParams(searchParams)
    if (key === '0') {
      newParams.delete('group_id')
    } else {
      newParams.set('group_id', key)
    }
    setSearchParams(newParams, { replace: true })
  }

  const handleSearchFocus = () => {
    if (!isLoggedIn()) {
      showLoginModal()
    }
  }

  const listClassName = flatMode
    ? `flex flex-col gap-2 ${isSoftStyle ? 'mt-2 mb-16' : 'my-3'}`
    : `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${isSoftStyle ? 'mt-4 mb-16' : 'my-3'}`

  return (
    <div>
      <div
        className={`${selectMode ? '' : 'sticky z-[100]'} bg-white`}
        style={{ top: isSoftStyle ? '120px' : '30px' }}
      >
        <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between bg-white py-1">
          <Tabs
            items={tabItems}
            activeKey={String(groupId)}
            onChange={handleTabChange}
            className="flex-1 index-tabs overflow-hidden"
          />
          <div className="w-full md:w-auto">
            <Search
              value={keyword}
              onDebouncedChange={setKeyword}
              onFocus={handleSearchFocus}
              className="hidden md:flex"
              placeholder={t('action.search') + t('module.agent')}
            />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={handleSearchFocus}
              size="large"
              className="w-full md:hidden el-input--main"
              placeholder={t('action.search') + t('module.agent')}
              prefix={<SearchOutlined />}
            />
          </div>
        </div>
      </div>
      <AgentList
        type="explore"
        loading={loading}
        keyword={keyword}
        list={showAgentList}
        groupId={groupId}
        selectMode={selectMode}
        flatMode={flatMode}
        className={listClassName}
      />
    </div>
  )
}

export default GroupList
