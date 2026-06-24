# Chat Plugin Standard Structure

## 目录结构

```
apps/<plugin-name>/
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx          # 入口，挂载 React
│   ├── App.tsx           # useAuthGuard + LoginForm/ChatView 切换
│   ├── config.ts         # 插件配置（PluginConfig）
│   ├── adapters/
│   │   ├── index.ts      # 导出所有适配器
│   │   ├── conversation.ts  # IConversationApi 实现
│   │   ├── agent.ts         # IAgentApi 实现
│   │   └── upload.ts        # IUploadApi 实现
│   └── ChatView.tsx      # 组合 BubbleList、Sender，注入 adapters
```

## 必须实现

1. **PluginConfig** - 定义插件类型和功能开关
2. **PluginAdapters** - 实现 IConversationApi、IAgentApi、IUploadApi
3. **App.tsx** - 处理登录/聊天视图切换

## 使用方式

```tsx
import { ChatProvider, LoginForm, useAuthGuard } from '@km/shared-business'
import { config } from './config'
import { adapters } from './adapters'

function App() {
  const { isLoggedIn, isLoading } = useAuthGuard()

  if (isLoading) return <div>Loading...</div>
  if (!isLoggedIn) return <LoginForm />

  return (
    <ChatProvider config={config} adapters={adapters}>
      <ChatView />
    </ChatProvider>
  )
}
```
