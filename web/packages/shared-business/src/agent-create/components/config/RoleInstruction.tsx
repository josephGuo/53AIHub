import { Tooltip } from 'antd'
import { SvgIcon, PromptInput } from '@km/shared-components-react'
import { useAgentCreateAdapter } from '../../adapters'
import { useAgentForm } from '../../hooks'
import { copyToClip } from '@km/shared-utils'
import { message } from 'antd'

export function RoleInstruction() {
  const form = useAgentForm()
  const adapter = useAgentCreateAdapter()
  const t = adapter.t || ((key: string) => key)

  const prompt = form.formData.prompt

  const onPromptChange = (value: string) => {
    form.updateField('prompt', value)
  }

  const onOptimize = () => {
    return message.warning(t('term.feature_coming_soon'))
  }

  const onGenerate = () => {
    return message.warning(t('term.feature_coming_soon'))
  }

  const onCopy = async (text: string) => {
    await copyToClip(text)
    message.success(t('action.copy_success'))
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      <div
        className={`h-11 flex items-center`}
      >
        <div
          className="flex-1 text-sm text-[var(--ant-form-label-color] truncate"
          title={t('app.role_instruction')}
        >
          {t('app.role_instruction')}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip placement="top" title={t('term.optimize_tip')}>
            <span
              className="flex-center gap-1 text-[#2563EB] text-sm px-1 cursor-pointer opacity-60 pointer-events-none"
              onClick={(e) => {
                e.stopPropagation()
                onOptimize()
              }}
            >
              <SvgIcon name="hglt" size="18px" />
              {t('term.optimize')}
            </span>
          </Tooltip>
          <div className="flex-none h-4 w-px border-r border-[#E1E2E6]" />
          <Tooltip placement="top" title={t('term.generate_tip')}>
            <span
              className="text-[#182B50] px-1 cursor-pointer opacity-60 pointer-events-none"
              onClick={(e) => {
                e.stopPropagation()
                onGenerate()
              }}
            >
              <SvgIcon name="magic-stick" size="18px" />
            </span>
          </Tooltip>
          <Tooltip placement="top" title={t('action.copy')}>
            <span
              className="text-[#182B50] px-1 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                onCopy(prompt)
              }}
            >
              <SvgIcon name="copy" size="18px" />
            </span>
          </Tooltip>
        </div>
      </div>
      <div className="flex-1 border rounded-xl bg-white overflow-y-auto">
        <PromptInput
          value={prompt}
          onChange={onPromptChange}
          style={{
            height: '100%',
            minHeight: '200px',
            borderRadius: 4,
          }}
          placeholder={t('agent.role_instruction_placeholder')}
          wordWrap
          t={t}
        />
      </div>
    </div>
  )
}

export default RoleInstruction