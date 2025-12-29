# WeChat macOS Key Extractor

使用 Frida 动态分析提取 macOS 微信 4.0+ 数据库加密密钥的工具。

## 原理

WeChat macOS 4.0+ 使用 WCDB/SQLCipher 加密本地数据库。解密时会调用 macOS 系统的 `CCKeyDerivationPBKDF` 函数进行密钥派生。通过 Frida hook 这个函数，可以捕获原始加密密钥。

### 技术细节

- **加密方式**: SQLCipher (WCDB)
- **密钥派生**: PBKDF2-HMAC-SHA512
- **迭代次数**: 256000
- **密钥长度**: 32 字节
- **页大小**: 4096 字节
- **保留区**: 80 字节 (16 IV + 64 HMAC)

## 前置条件

### 1. 禁用 SIP (System Integrity Protection)

```bash
# 重启进入恢复模式 (Intel: Cmd+R, Apple Silicon: 长按电源键)
# 打开终端，执行:
csrutil disable

# 重启后验证
csrutil status
# 应显示: System Integrity Protection status: disabled.
```

### 2. 安装 Frida

```bash
pip3 install frida-tools
```

### 3. 安装 chatlog (可选，用于后续解密)

```bash
brew install sjzar/tap/chatlog
```

## 使用方法

### 方法一：使用 frida-trace (推荐)

```bash
# 1. 启动微信并登录

# 2. 获取微信 PID
pgrep -x WeChat

# 3. 使用 frida-trace hook PBKDF 函数
frida-trace -p <PID> -i "CCKeyDerivationPBKDF"

# 4. 在微信中进行一些操作（打开聊天等），触发数据库访问
# 5. 观察终端输出，密钥会显示在日志中
```

### 方法二：使用自定义脚本

```bash
# 1. 获取微信 PID
WECHAT_PID=$(pgrep -x WeChat)

# 2. 运行提取脚本
frida -p $WECHAT_PID -l extract_key.js
```

### 方法三：一键提取

```bash
# 使用 shell 脚本自动完成所有步骤
./extract_key.sh
```

## 输出示例

```
[*] Hooking CCKeyDerivationPBKDF...
[+] CCKeyDerivationPBKDF called!
    Algorithm: 2 (PBKDF2)
    Password Length: 32
    Salt Length: 16
    PRF: 5 (SHA512)
    Rounds: 256000
    Derived Key Length: 32
[!!!] RAW KEY: 96a696f1dfe14e29a0efc135048a700ea5b94a86e29f4f96b19900a0a5c82f26
```

## 使用密钥

### 配置 chatlog

创建配置文件 `~/.chatlog/chatlog-server.yaml`:

```yaml
platform: darwin
version: 4
data_dir: /Users/<用户名>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<wxid>/
data_key: <提取到的密钥>
work_dir: /tmp/chatlog_output
http_addr: 127.0.0.1:5030
```

启动 chatlog 服务:

```bash
chatlog server -c ~/.chatlog/chatlog-server.yaml
```

### Python 解密示例

```python
from decrypt_wcdb import decrypt_database

decrypt_database(
    db_path="message_0.db",
    key="96a696f1dfe14e29a0efc135048a700ea5b94a86e29f4f96b19900a0a5c82f26",
    output_path="message_0_decrypted.db"
)
```

## 文件说明

```
├── README.md                 # 本文档
├── extract_key.js           # Frida 密钥提取脚本
├── extract_key.sh           # 一键提取 shell 脚本
├── decrypt_wcdb.py          # Python 解密工具
└── frida_trace_handler.js   # frida-trace 自定义 handler
```

## 常见问题

### Q: 提示 "Failed to attach: unexpected error while attaching to process"
A: 需要禁用 SIP，参见前置条件。

### Q: 没有捕获到密钥
A: 确保微信已登录，并在运行 frida-trace 后操作微信触发数据库访问（打开聊天、刷新等）。

### Q: chatlog 提示 "unsupported platform"
A: 使用 `--version 4` 参数，或在配置文件中设置 `version: 4`。

## 免责声明

本工具仅供安全研究和个人数据备份使用。请遵守相关法律法规，不要用于非法目的。

## 参考

- [Frida](https://frida.re/)
- [chatlog](https://github.com/sjzar/chatlog)
- [SQLCipher](https://www.zetetic.net/sqlcipher/)

## License

MIT
