# ChatSync 智聊清单

一个基于 Next.js 的微信聊天记录分析工具，可以自动提取待办事项并生成聊天词云。

## 功能特性

- **微信聊天记录连接**: 通过 [chatlog](https://github.com/sjzar/chatlog) 工具读取本地微信聊天记录
- **AI待办提取**: 使用 Claude AI 自动分析聊天内容，提取待办事项
- **聊天词云**: 生成群聊/好友的高频词汇词云图
- **用户认证**: 支持邮箱注册登录
- **数据持久化**: MongoDB 存储待办事项

## 技术栈

- **前端**: Next.js 14 + React 18 + TypeScript
- **样式**: Tailwind CSS
- **认证**: NextAuth.js
- **数据库**: MongoDB + Mongoose
- **AI**: Claude API
- **词云**: wordcloud.js

## 项目结构

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/       # AI分析接口
│   │   │   ├── auth/          # 认证相关
│   │   │   ├── todos/         # 待办CRUD
│   │   │   ├── webhook/       # Webhook接口
│   │   │   └── wordcloud/     # 词云生成
│   │   ├── wechat-connect/    # 微信连接页面
│   │   ├── page.tsx           # 主页
│   │   └── layout.tsx
│   ├── components/
│   │   └── WordCloud.tsx      # 词云组件
│   ├── lib/
│   │   ├── auth.ts            # NextAuth配置
│   │   └── mongodb.ts         # MongoDB连接
│   └── models/
│       ├── Todo.ts            # 待办模型
│       └── User.ts            # 用户模型
└── wechat-key-extractor/      # 微信密钥提取工具
    ├── README.md              # 工具文档
    ├── extract_key.js         # Frida 提取脚本
    ├── extract_key.sh         # 一键提取脚本
    └── decrypt_wcdb.py        # Python 解密工具
```

## 快速开始

### 1. 安装 chatlog

```bash
# macOS
brew install sjzar/tap/chatlog

# 或从源码安装
go install github.com/sjzar/chatlog@latest
```

### 2. 获取微信数据库密钥 (macOS WeChat 4.0+)

微信 4.0+ 使用 WCDB 加密数据库，需要先提取密钥。

#### 方法一：使用本项目的提取工具

```bash
# 进入工具目录
cd wechat-key-extractor

# 运行一键提取脚本
./extract_key.sh
```

#### 方法二：手动使用 Frida

```bash
# 1. 安装 Frida
pip3 install frida-tools

# 2. 禁用 SIP (需重启进入恢复模式)
csrutil disable

# 3. 获取微信 PID
pgrep -x WeChat

# 4. Hook PBKDF 函数提取密钥
frida-trace -p <PID> -i "CCKeyDerivationPBKDF"

# 5. 在微信中进行操作，观察终端输出捕获密钥
```

详细说明请参考 [wechat-key-extractor/README.md](./wechat-key-extractor/README.md)

### 3. 启动 chatlog 服务

```bash
chatlog server -a 127.0.0.1:5030 \
  -d "微信数据目录" \
  -k "提取到的密钥" \
  -w "/tmp/chatlog_output" \
  -p darwin \
  -v 4
```

微信数据目录通常位于：
```
~/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_xxx/
```

### 4. 配置环境变量

创建 `.env.local` 文件：

```env
MONGODB_URI=mongodb://localhost:27017/chatsync
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=your-claude-api-key
```

### 5. 安装依赖并运行

```bash
npm install
npm run dev
```

访问 http://localhost:3000

## 使用方法

### 生成词云

1. 打开「微信连接」页面
2. 点击「连接」按钮连接 chatlog 服务
3. 选择要分析的群聊或好友
4. 点击「生成词云」按钮

### AI提取待办

1. 连接 chatlog 服务
2. 选择会话
3. 点击「AI分析提取待办」
4. 等待分析完成，待办会自动保存

## API 接口

### POST /api/wordcloud

生成词云数据

```json
{
  chatContent: 聊天记录文本,
  limit: 100
}
```

### POST /api/analyze

AI分析聊天内容提取待办

```json
{
  chatContent: 聊天记录文本,
  source: 来源名称
}
```

### GET/POST /api/todos

待办事项 CRUD

## 部署

项目已部署在 Sealos 平台。

## License

MIT
