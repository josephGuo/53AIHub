import { useRef, useEffect } from 'react';
import { Form } from 'antd';
import { useAgentCreateAdapter } from '../../adapters';
import { useAgentForm } from '../../hooks';
import { useAgentFormStore } from '../../store';

export function UseScope() {
  // 使用 adapter 获取翻译函数和组件
  const adapter = useAgentCreateAdapter();
  const t = adapter.t || ((key: string) => key);
  const GroupSelect = adapter.GroupSelectComponent;

  // 使用 hook 获取状态和方法
  const { formData, updateField, isNew } = useAgentForm()
  const subscriptionGroupIds = formData.subscription_group_ids
  const userGroupIds = formData.user_group_ids

  // 使用 adapter 获取企业信息
  const isIndependent = adapter.isIndependent || false
  const isIndustry = adapter.isIndustry || false
  const isEnterprise = adapter.isEnterprise || false

  // 从 store 获取 loading 状态
  const loading = useAgentFormStore((state) => state.loading)

  // 缓存分组选项
  const subscriptionOptionsRef = useRef<any[]>([])
  const userGroupOptionsRef = useRef<any[]>([])

  // 记录是否已应用默认值，使用 isNew 作为 key 来重置
  const appliedDefaultKeyRef = useRef<string>('')
  const didApplySubscriptionDefaultRef = useRef(false)
  const didApplyUserDefaultRef = useRef(false)

  // 当 isNew 变化时，重置已应用标记
  const currentKey = isNew ? 'new' : 'edit'
  if (appliedDefaultKeyRef.current !== currentKey) {
    appliedDefaultKeyRef.current = currentKey
    didApplySubscriptionDefaultRef.current = false
    didApplyUserDefaultRef.current = false
  }

  // 当 loading 从 true 变为 false（详情加载完成），检查是否需要设置默认值
  const prevLoadingRef = useRef(loading)
  useEffect(() => {
    // loading 从 true 变为 false，说明详情加载完成
    if (prevLoadingRef.current === true && loading === false && isNew) {
      // 检查是否需要设置默认值
      if (!didApplySubscriptionDefaultRef.current && subscriptionOptionsRef.current.length > 0) {
        const currentValue = useAgentFormStore.getState().form_data.subscription_group_ids
        if (!currentValue || currentValue.length === 0) {
          didApplySubscriptionDefaultRef.current = true
          updateField('subscription_group_ids', subscriptionOptionsRef.current.map(opt => opt.group_id))
        }
      }
      if (!didApplyUserDefaultRef.current && userGroupOptionsRef.current.length > 0) {
        const currentValue = useAgentFormStore.getState().form_data.user_group_ids
        if (!currentValue || currentValue.length === 0) {
          didApplyUserDefaultRef.current = true
          updateField('user_group_ids', userGroupOptionsRef.current.map(opt => opt.group_id))
        }
      }
    }
    prevLoadingRef.current = loading
  }, [loading, isNew, updateField])

  // 如果没有 GroupSelect 组件，则不渲染
  if (!GroupSelect) {
    return null
  }

  return (
    <>
      <Form.Item
        hidden={!(isIndependent || isIndustry)}
        label={t('user.register_user')}
        style={{ marginBottom: '12px' }}
        layout="vertical"

      >
        <GroupSelect
          value={subscriptionGroupIds || []}
          onChange={(value: number | number[]) => updateField('subscription_group_ids', Array.isArray(value) ? value : [value])}
          type="checkbox"
          groupType={adapter.GROUP_TYPE?.USER || 'user'}
          multiple
          onOptionsLoad={(options: any[]) => {
            // 缓存选项
            subscriptionOptionsRef.current = options
          }}
        />
      </Form.Item>
      <Form.Item
        hidden={!(isEnterprise || isIndustry)}
        label={t('user.internal_user')}
        layout="vertical"
      >
        <GroupSelect
          value={userGroupIds || []}
          onChange={(value: number | number[]) => updateField('user_group_ids', Array.isArray(value) ? value : [value])}
          type="picker"
          groupType={adapter.GROUP_TYPE?.INTERNAL_USER || 'internal_user'}
          multiple
          onOptionsLoad={(options: any[]) => {
            // 缓存选项
            userGroupOptionsRef.current = options
          }}
        />
      </Form.Item>
    </>
  )
}

export default UseScope