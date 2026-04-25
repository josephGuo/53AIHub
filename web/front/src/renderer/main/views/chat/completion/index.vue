<template>
  <div class="h-full bg-[#F5F6F7] flex flex-col">
    <MainHeader v-if="!hideMenuHeader">
      <template #before_suffix>
        <div class="text-base text-primary line-clamp-1 max-md:flex-1 max-md:text-center" :title="currentAgent.name || ''">
          {{ currentAgent.name || '' }}
        </div>
      </template>
      <template #after_prefix>
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex">
          <span class="flex items-center gap-1 text-sm cursor-pointer md:hidden" @click="$router.back()">
            <svg-icon name="return" size="18" stroke></svg-icon>
          </span>
          <div
            v-tooltip="{ content: $t('chat.usage_guide') }"
            class="h-[26px] px-2 rounded-full flex-center gap-1.5 text-sm text-primary cursor-pointer hover:bg-[#E1E2E3]"
            @click="handleToggleGuide"
          >
            <div class="size-4">
              <svg-icon name="layout-split" size="18"></svg-icon>
            </div>
          </div>
        </div>
      </template>
    </MainHeader>
    <div class="h-full flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-y-auto">
      <div class="w-full lg:w-2/5 md:w-2/5 md:h-full bg-white rounded flex flex-col mb-3 md:mb-0">
        <h3 class="flex-none h-14 flex items-center px-4 md:px-7 text-base text-[#1D1E1F] border-b">
          {{ $t('chat.input') }}
        </h3>
        <div class="flex-1 p-4 overflow-y-auto">
          <el-form ref="formRef" :model="inputForm" label-position="top" require-asterisk-position="right" @submit.prevent>
            <template v-for="(item, index) in inputForm" :key="item.id">
              <el-form-item
                v-if="item.type === 'text'"
                :prop="`${index}.value`"
                :label="item.label"
                :required="item.required"
                :rules="[getRequiredRules($t('form.input_placeholder') + item.label, 'blur')]"
              >
                <el-input
                  v-model="item.value"
                  size="large"
                  :placeholder="$t('form.input_placeholder')"
                  :maxlength="item.max_length ? item.max_length : -1"
                  :show-word-limit="item.show_word_limit"
                />
                <div v-if="item.desc" class="text-xs text-[#182b50] text-opacity-30 mt-1">
                  {{ item.desc }}
                </div>
              </el-form-item>
              <el-form-item
                v-else-if="item.type === 'textarea'"
                :prop="`${index}.value`"
                :label="item.label"
                :required="item.required"
                :rules="[getRequiredRules($t('form.input_placeholder') + item.label, 'blur')]"
              >
                <el-input
                  v-model="item.value"
                  size="large"
                  type="textarea"
                  :rows="4"
                  resize="none"
                  :placeholder="$t('form.input_placeholder')"
                  :maxlength="item.max_length ? item.max_length : -1"
                  :show-word-limit="item.show_word_limit"
                />
                <div v-if="item.desc" class="text-xs text-[#182b50] text-opacity-30 mt-1">
                  {{ item.desc }}
                </div>
              </el-form-item>
              <el-form-item
                v-else-if="item.type === 'inputNumber'"
                :prop="`${index}.value`"
                :label="item.label"
                :required="item.required"
                :rules="[getRequiredRules($t('form.input_placeholder') + item.label, 'blur')]"
              >
                <div>
                  <el-input-number v-model="item.value" size="large" :min="1" :placeholder="$t('form.input_placeholder')" />
                  <div v-if="item.desc" class="text-xs text-[#182b50] text-opacity-30 mt-1">
                    {{ item.desc }}
                  </div>
                </div>
              </el-form-item>
              <el-form-item
                v-else-if="item.type === 'select'"
                :prop="`${index}.value`"
                :label="item.label"
                :required="item.required"
                :rules="[getRequiredRules($t('form.select_placeholder') + item.label, 'change')]"
              >
                <el-select v-model="item.value" class="w-full" size="large" :multiple="item.multiple" :placeholder="$t('form.select_placeholder')">
                  <el-option v-for="option in item.options" :key="option.value" :label="option.label" :value="option.label" />
                </el-select>
                <div v-if="item.desc" class="text-xs text-[#182b50] text-opacity-30 mt-1">
                  {{ item.desc }}
                </div>
              </el-form-item>

              <el-form-item
                v-else-if="item.type === 'date'"
                :prop="`${index}.value`"
                :label="item.label"
                :required="item.required"
                :rules="[getRequiredRules($t('form.select_placeholder'), ['change', 'blur'])]"
              >
                <el-time-picker
                  v-if="item.date_format === 'h-m'"
                  v-model="item.value"
                  format="HH:mm"
                  size="large"
                  value-format="HH:mm"
                  :placeholder="$t('form.select_placeholder')"
                />
                <el-date-picker
                  v-else-if="item.date_format === 'y'"
                  v-model="item.value"
                  size="large"
                  type="year"
                  value-format="YYYY"
                  :placeholder="$t('form.select_placeholder')"
                />
                <el-date-picker
                  v-else-if="item.date_format === 'y-m'"
                  v-model="item.value"
                  size="large"
                  type="month"
                  value-format="YYYY-MM"
                  :placeholder="$t('form.select_placeholder')"
                />
                <el-date-picker
                  v-else-if="item.date_format === 'y-m-d'"
                  v-model="item.value"
                  size="large"
                  type="date"
                  value-format="YYYY-MM-DD"
                  :placeholder="$t('form.select_placeholder')"
                />
                <el-date-picker
                  v-else-if="item.date_format === 'y-m-d-h'"
                  v-model="item.value"
                  size="large"
                  type="datetime"
                  format="YYYY-MM-DD HH"
                  time-format="HH"
                  value-format="YYYY-MM-DD HH"
                  :placeholder="$t('form.select_placeholder')"
                />
                <el-date-picker
                  v-else-if="item.date_format === 'daterange'"
                  v-model="item.value"
                  size="large"
                  type="daterange"
                  value-format="YYYY-MM-DD HH:mm"
                  :start-placeholder="$t('form.select_placeholder')"
                  :end-placeholder="$t('form.select_placeholder')"
                />

                <div v-if="item.desc" class="text-xs text-[#182b50] text-opacity-30 mt-1">
                  {{ item.desc }}
                </div>
              </el-form-item>

              <el-form-item
                v-else-if="item.type === 'tag'"
                :prop="`${index}.value`"
                :label="item.label"
                :required="item.required"
                :rules="[{ validator: validator(item), trigger: 'change' }]"
              >
                <div>
                  <div class="flex flex-wrap gap-3">
                    <template v-for="(tag, childIndex) in item.value" :key="childIndex">
                      <div
                        class="border bordre-[#B0B7C3] rounded-sm min-h-[32px] inline-flex items-center px-3 py-1 text-xs text-[#182B50] text-opacity-80 break-all"
                      >
                        {{ tag }}
                        <el-icon class="cursor-pointer ml-1" color="#d2d5dc" @click="handleDelTag(item, childIndex)">
                          <Close />
                        </el-icon>
                      </div>
                    </template>
                    <el-input
                      v-if="item.focus"
                      v-model="item.temp"
                      autofocus
                      style="width: 104px"
                      class="h-8"
                      :placeholder="$t('form.input_placeholder')"
                      @keypress.enter="handleAddTag(item)"
                      @blur="handleAddTag(item)"
                    />
                    <div
                      v-else
                      class="border bordre-[#B0B7C3] border-dashed rounded-sm h-8 inline-flex items-center px-3 cursor-pointer"
                      @click="handleFocusTag(item)"
                    >
                      <span class="text-xs text-[#182B50] text-opacity-80">+ {{ $t('action.add') }}</span>
                    </div>
                  </div>
                  <div v-if="item.desc" class="text-xs text-[#182b50] text-opacity-30 mt-1">
                    {{ item.desc }}
                  </div>
                </div>
              </el-form-item>

              <el-form-item
                v-else-if="['file', 'array_image', 'array_audio', 'array_video', 'array_file'].includes(item.type)"
                :prop="`${index}.value`"
                :label="item.label"
                :required="item.required"
                :rules="[{ validator: validator(item), trigger: ['change', 'blur'] }]"
              >
                <div class="w-full">
                  <div v-show="item.limit !== item.value.length">
                    <FileUpload
                      ref="uploadRef"
                      v-model:file-list="item.value"
                      class="w-20"
                      drag
                      :accept="item.file_accept.map((item) => `.${item}`).join(',')"
                      :limit="item.file_limit"
                      :multiple="item.file_limit === 1 ? false : true"
                      :size="item.file_size"
                      :show-file-list="false"
                    >
                      <div class="w-20 h-20 border border-dashed rounded-sm flex-center flex-col">
                        <!-- <img class="w-4 h-4" src="/images/upload.png" /> -->

                        <div class="text-xs text-[#182B5066] mt-2">{{ $t('action.click_upload') }}</div>
                      </div>
                    </FileUpload>
                  </div>
                  <template v-for="file in item.value" :key="file.uid">
                    <div class="h-9 px-2 border rounded mt-3 flex items-center gap-2">
                      <div class="flex-1 text-sm text-[#182B50] truncate">
                        {{ file.name }}
                      </div>
                      <div v-if="file.status === 'success'" class="flex items-center">
                        <el-button type="primary" link @click="handleViewFile(file)">{{ $t('action.view') }}</el-button>
                        <el-image-viewer v-if="imageVisible" :url-list="[imageFile]" show-progress :initial-index="0" @close="imageVisible = false" />
                        <div class="w-px h-4 mx-1 bg-[#E3E5EA]" />
                        <el-button type="danger" link @click="handleDelFile(file, item)">{{ $t('action.delete') }}</el-button>
                      </div>
                      <div v-else class="flex items-center">
                        <el-icon class="animate-rotate">
                          <Loading />
                        </el-icon>
                      </div>
                    </div>
                  </template>

                  <div class="flex items-center gap-1 mt-2">
                    <el-icon size="14" color="#182B50">
                      <Warning />
                    </el-icon>
                    <span class="text-xs text-[#182B50CC]">{{ $t('file.file_size', { size: item.file_size }) }}</span>
                  </div>
                  <p class="text-xs text-[#182B50CC]">{{ $t('file.file_format', { format: item.file_accept.join('、') }) }}</p>
                </div>
              </el-form-item>

              <template v-if="item.type === 'array_text'">
                <el-form-item
                  v-for="(input, inputIndex) in item.value"
                  :key="inputIndex"
                  :prop="`${index}.value[${inputIndex}]`"
                  :label="inputIndex === 0 ? item.label : ''"
                  :required="item.required"
                  :rules="[{ required: item.required, message: $t('form.input_placeholder') + item.label, trigger: 'blur' }]"
                  class="relative"
                >
                  <el-input
                    v-model="item.value[inputIndex]"
                    size="large"
                    :placeholder="$t('form.input_placeholder')"
                    :maxlength="item.max_length ? item.max_length : -1"
                    :show-word-limit="item.show_word_limit"
                  >
                    <template #suffix>
                      <svg-icon name="del" width="16" class="cursor-pointer hover:opacity-60" @click="handleArrayTextDelete(item, inputIndex)" />
                    </template>
                  </el-input>
                  <div v-if="item.desc" class="text-xs text-[#182b50] text-opacity-30 mt-1">
                    {{ item.desc }}
                  </div>
                  <el-button v-if="inputIndex === 0" link type="primary" class="absolute -top-7 right-0" @click="handleArrayTextAdd(item)">
                    <el-icon class="mr-1"><Plus /></el-icon>
                    {{ $t('action.add') }}
                  </el-button>
                </el-form-item>
              </template>
            </template>
          </el-form>
        </div>
        <div class="border-t px-4 md:px-7 py-4 md:py-5">
          <el-button :loading="loading" class="w-full" size="large" type="primary" @click="handleRun">{{ $t('chat.start_generate') }}</el-button>
        </div>
      </div>
      <div class="flex-1 md:h-full bg-white rounded flex flex-col">
        <h3 class="flex-none h-14 flex items-center px-4 md:px-7 text-base text-[#1D1E1F] border-b">
          {{ $t('chat.output') }}
        </h3>
        <div class="flex-1 px-4 p-6 overflow-y-auto relative">
          <div v-if="showOutput && !loading" class="absolute right-1 top-2 flex items-center z-10">
            <div v-copy="resultStr" class="px-2 rounded flex-center gap-1 text-sm text-[#1D1E1F] cursor-pointer">
              <el-icon><CopyDocument /></el-icon>
              {{ $t('action.copy') }}
            </div>
            <div v-debounce class="px-2 rounded flex-center gap-1 text-sm text-[#1D1E1F] cursor-pointer" @click="handleDownload">
              <el-icon><Download /></el-icon>
              {{ $t('action.download') }}
            </div>
          </div>

          <el-empty
            v-if="!showOutput"
            :image="$getPublicPath('/images/chat/completion_empty.png')"
            :description="$t('chat.completion_empty_desc')"
          ></el-empty>

          <template v-else>
            <div v-for="item in result" :key="item.id">
              <div class="text-sm text-[#1D1E1F] mt-2">
                <!-- <x-md-renderer :content="result" /> -->
                <x-bubble-assistant v-if="item.type === 'markdown'" :content="item.value" :streaming="loading"></x-bubble-assistant>
                <div v-else-if="item.type.includes('image')" class="overflow-hidden flex flex-col gap-5">
                  <img
                    v-for="(src, index) in Array.isArray(item.value) ? item.value : [item.value]"
                    :key="index"
                    :src="src"
                    class="max-w-full h-auto object-contain rounded"
                  />
                </div>
                <div v-else-if="item.type.includes('video')" class="overflow-hidden flex flex-col gap-5">
                  <video
                    v-for="(src, index) in Array.isArray(item.value) ? item.value : [item.value]"
                    :key="index"
                    :src="getSrc(src, item.id)"
                    controls
                    class="max-w-full h-auto"
                  ></video>
                </div>
                <div v-else-if="item.type.includes('audio')" class="overflow-hidden flex flex-col gap-5">
                  <audio
                    v-for="(src, index) in Array.isArray(item.value) ? item.value : [item.value]"
                    :key="index"
                    :src="getSrc(src, item.id)"
                    controls
                    class="max-w-full"
                  ></audio>
                </div>
                <div v-else-if="item.type.includes('text')">
                  <p
                    v-for="(text, index) in Array.isArray(item.value) ? item.value : [item.value]"
                    :key="index"
                    class="whitespace-pre-wrap break-all"
                  >
                    {{ text }}
                  </p>
                </div>
              </div>
            </div>
          </template>
        </div>
        <template v-if="currentAgent.settings_obj?.relate_agents?.length && showOutput && !loading">
          <div class="sticky top-[100%] pb-2">
            <RelatedScene :is-workflow="true" :output="result" @init-agent="initAgent" />
          </div>
        </template>

        <!-- 输出 -->
        <!-- class="h-full" -->
      </div>
    </div>
  </div>

  <!-- 右侧帮助面板 -->
  <Transition name="slide">
    <div
      v-if="showHelper"
      class="border-l bg-white left-0 right-0 top-0 bottom-0 z-[10]"
      :class="[useCaseFixed && showHelper ? 'fixed' : 'absolute']"
    >
      <div class="h-[70px] flex-center border-b relative">
        <h4 class="text-lg text-primary">{{ $t('chat.usage_guide') }}</h4>
        <div
          class="flex-center size-6 absolute right-2 top-1/2 -translate-y-1/2 rounded cursor-pointer hover:bg-[#ECEDEE]"
          @click="handleToggleGuide"
        >
          <el-icon>
            <Close />
          </el-icon>
        </div>
      </div>
      <Helper :agent="currentAgent"></Helper>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect, nextTick } from 'vue'
import { Download, CopyDocument, Close, Warning, Loading, Plus } from '@element-plus/icons-vue'
import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'

import { useConversationStore } from '@/stores/modules/conversation'
import { getRequiredRules } from '@/utils/form-rules'
import { checkPermission } from '@/utils/permission'
import chatApi from '@/api/modules/chat'
import { downloadFile } from '@/utils/file'

import MainHeader from '@/layout/header.vue'
import FileUpload from '@/components/Upload/index.vue'
import Helper from '../helper.vue'
import RelatedScene from '@/components/RelatedScene/index.vue'

import { isUrl } from '@/utils/url'

withDefaults(
  defineProps<{
    hideMenuHeader: boolean
    useCaseFixed: boolean
  }>(),
  {
    hideMenuHeader: false,
    useCaseFixed: false
  }
)

const convStore = useConversationStore()

const currentAgent = computed(() => convStore.currentAgent)

const formRef = ref<FormInstance>()

const inputForm = ref<any>([])
const abortController = ref<AbortController | null>(null)
const loading = ref(false)
const showOutput = ref(false)
const result = ref([])
const resultStr = ref('')
const showHelper = ref(false)
const imageVisible = ref(false)
const imageFile = ref()

const validator = (item) => {
  return (rule, value, callback) => {
    if (item.required) {
      let hasVal = false
      if (['file', 'array_image', 'array_audio', 'array_video', 'array_file'].includes(item.type)) {
        hasVal = Array.isArray(item.value) && item.value.length > 0
      } else if (Array.isArray(item.value)) {
        hasVal = item.value.some((val) => val && String(val).trim().length > 0)
      } else {
        hasVal = item.value && String(item.value).trim().length > 0
      }
      if (hasVal) callback()
      else callback(new Error(`请添加${item.label}`))
    } else {
      callback()
    }
  }
}

// 从对象中获取url
const getSrc = (value: any, id: string) => {
  if (typeof value === 'object' && value !== null) {
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const val = value[key]
        if (typeof val === 'string' && isUrl(val)) {
          return val
        }
      }
    }
    result.value = result.value.filter((item) => item.id !== id)
    ElMessage.error(window.$t('chat.not_found_url'))
  }
  return value
}

const handleFocusTag = (item) => {
  item.temp = ''
  item.focus = true
}
const handleAddTag = (item) => {
  const temp = item.temp.trim()
  if (temp) {
    item.value.unshift(temp)
    item.temp = ''
  }
  item.focus = false
}
const handleDelTag = (item, index) => {
  item.value.splice(index, 1)
}
const handleArrayTextAdd = (item) => {
  item.value.push('')
}
const handleArrayTextDelete = (item, index) => {
  if (item.value.length === 1) {
    item.value = ['']
    return
  }
  item.value.splice(index, 1)
}
const handleViewFile = (file) => {
  imageVisible.value = true
  imageFile.value = file?.url
}
const handleDelFile = (file, item) => {
  item.value = item.value.filter((item) => item.id !== file.id)
}

const handleDownload = () => {
  downloadFile(result.value, `result_output_${Date.now()}.json`)
}

const getInputs = () => {
  const inputs = inputForm.value.reduce(
    (result, item) => {
      if (item.value.toString() === '') return result
      if (item.type === 'file') {
        result[`${item.variable}`] = item.value.map((item) => `file_id:${item.id}`).join(',')
      } else if (['array_image', 'array_audio', 'array_video', 'array_file'].includes(item.type)) {
        result[`${item.variable}`] = item.value.map((item) => `file_id:${item.id}`)
      } else if (item.type === 'array_text') {
        result[`${item.variable}`] = item.value
      } else {
        result[`${item.variable}`] =
          item.type === 'select' && !item.multiple ? item.value : Array.isArray(item.value) ? item.value.join(',') : String(item.value)
      }
      return result
    },
    {} as Record<string, string>
  )
  Object.keys(inputs).forEach((key) => {
    if (inputs[key] === '' || inputs[key] === null) {
      delete inputs[key]
    }
  })
  return inputs
}

const getQuestion = (inputs): string => {
  let question = ''
  let index = 0
  const keys = Object.keys(inputs)
  if (keys.length === 0) return ''
  while (!question) {
    const value = inputs[keys[index]]
    if (value) {
      question = String(question).slice(0, 20)
      return question
    }
    index++
  }
  return ''
}

const workflowRun = async () => {
  result.value = []
  resultStr.value = ''
  const { agent_id } = currentAgent.value
  const inputs = getInputs()
  const conversation = await convStore.createConversation(agent_id, getQuestion(inputs))

  const data = {
    conversation_id: conversation.conversation_id,
    model: `agent-${agent_id}`,
    parameters: inputs,
    stream: true
  }
  loading.value = true
  abortController.value = new AbortController()
  showOutput.value = true
  chatApi.workflow
    .run(data, {
      onDownloadProgress: (e) => {
        console.log(e)
      },
      responseType: 'stream',
      signal: abortController.value?.signal
    })
    .then((response) => {
      const res = JSON.parse(response)
      const output = convStore.currentAgent.settings_obj.output_fields.reduce((result, item) => {
        if (!res.data.workflow_output_data[item.variable]) return result
        result.push({
          id: item.id,
          label: item.label,
          type: item.type,
          variable: item.variable,
          value: res.data.workflow_output_data[item.variable] || ''
        })
        return result
      }, [])
      result.value = output
      resultStr.value = output.map((item) => `${item.value}`).join('\n')
    })
    .finally(() => {
      loading.value = false
    })
}
const handleRun = async () => {
  const isValid = await formRef.value?.validate()
  if (!isValid) return
  checkPermission({
    groupIds: currentAgent.value.user_group_ids,
    onClick: async () => {
      const { agent_id } = currentAgent.value
      if (!agent_id) return ElMessage.warning(window.$t('chat.no_available_agent'))
      workflowRun()
      return true
    }
  })
}

const handleToggleGuide = () => {
  showHelper.value = !showHelper.value
}

const initAgent = () => {
  inputForm.value = (convStore.currentAgent.settings_obj?.input_fields || []).map((item) => {
    let value
    if (['tag', 'file', 'array_image', 'array_audio', 'array_video', 'array_file'].includes(item.type)) {
      value = []
    } else if (item.type === 'select' && item.multiple) {
      value = []
    } else if (item.type === 'array_text') {
      value = ['']
    } else {
      value = ''
    }
    return {
      ...item,
      temp: '',
      value
    }
  })

  if (convStore.next_agent_prepare.agent_id) {
    inputForm.value = inputForm.value.map((item) => {
      const value = convStore.next_agent_prepare.parameters?.[item.id]
      if (value) {
        if (Array.isArray(item.value)) {
          item.value = value.split(',') || []
        } else {
          item.value = value || ''
        }
      }
      return item
    })
    if (convStore.next_agent_prepare.execution_rule === 'auto') {
      handleRun()
    }
    convStore.setNextAgentPrepare({})
  }
}

watchEffect(() => {
  const agent_id = convStore.current_agentid
  if (agent_id) {
    nextTick(() => {
      initAgent()
    })
  }
})

defineExpose({
  showUseCase: () => {
    showHelper.value = true
  },
  hideUseCase: () => {
    showHelper.value = false
  }
})
</script>

<style>
.completion-form .el-form-item__label {
  text-indent: 12px;
  position: relative;
}

.completion-form .el-form-item__label::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 16px;
  background: #2563eb;
}
</style>
