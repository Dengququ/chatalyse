#!/bin/bash
#
# WeChat macOS Key Extractor
# 一键提取微信数据库密钥
#

set -e

echo "========================================"
echo "WeChat macOS Key Extractor"
echo "========================================"
echo ""

# 检查 SIP 状态
check_sip() {
    echo "[*] 检查 SIP 状态..."
    SIP_STATUS=$(csrutil status 2>&1)
    if echo "$SIP_STATUS" | grep -q "enabled"; then
        echo "[!] SIP 已启用，需要禁用才能进行 Frida 注入"
        echo "[!] 请重启进入恢复模式后执行: csrutil disable"
        exit 1
    fi
    echo "[+] SIP 已禁用"
}

# 检查 Frida
check_frida() {
    echo "[*] 检查 Frida..."
    if ! command -v frida &> /dev/null; then
        echo "[!] Frida 未安装，正在安装..."
        pip3 install frida-tools
    fi
    echo "[+] Frida 已安装: $(frida --version)"
}

# 检查微信进程
check_wechat() {
    echo "[*] 检查微信进程..."
    WECHAT_PID=$(pgrep -x WeChat 2>/dev/null || true)
    if [ -z "$WECHAT_PID" ]; then
        echo "[!] 微信未运行，请先启动微信并登录"
        exit 1
    fi
    echo "[+] 微信 PID: $WECHAT_PID"
}

# 获取微信数据目录
get_data_dir() {
    echo "[*] 查找微信数据目录..."
    DATA_BASE="/Users/$USER/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files"

    if [ ! -d "$DATA_BASE" ]; then
        echo "[!] 未找到微信数据目录"
        exit 1
    fi

    # 查找 wxid 目录
    WXID_DIR=$(find "$DATA_BASE" -maxdepth 1 -type d -name "wxid_*" | head -1)
    if [ -z "$WXID_DIR" ]; then
        echo "[!] 未找到 wxid 目录"
        exit 1
    fi

    echo "[+] 数据目录: $WXID_DIR"
}

# 运行 Frida 提取密钥
extract_key() {
    echo ""
    echo "[*] 开始提取密钥..."
    echo "[*] 请在微信中进行一些操作（打开聊天、刷新联系人等）以触发数据库访问"
    echo "[*] 密钥捕获后会自动保存到 /tmp/wechat_key.txt"
    echo ""
    echo "按 Ctrl+C 结束..."
    echo ""

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    frida -p "$WECHAT_PID" -l "$SCRIPT_DIR/extract_key.js"
}

# 显示结果
show_result() {
    echo ""
    if [ -f /tmp/wechat_key.txt ]; then
        KEY=$(cat /tmp/wechat_key.txt)
        echo "========================================"
        echo "[+] 密钥提取成功!"
        echo "========================================"
        echo ""
        echo "密钥: $KEY"
        echo ""
        echo "数据目录: $WXID_DIR"
        echo ""
        echo "你可以使用以下命令启动 chatlog 服务:"
        echo ""
        echo "chatlog server \\"
        echo "  -a 127.0.0.1:5030 \\"
        echo "  -d \"$WXID_DIR\" \\"
        echo "  -k \"$KEY\" \\"
        echo "  -p darwin \\"
        echo "  -v 4"
        echo ""
    else
        echo "[!] 未找到密钥文件"
    fi
}

# 主流程
main() {
    check_sip
    check_frida
    check_wechat
    get_data_dir

    # 捕获 Ctrl+C
    trap show_result EXIT

    extract_key
}

main
