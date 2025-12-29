#!/usr/bin/env python3
"""
WeChat WCDB/SQLCipher 数据库解密工具

使用方法:
    python3 decrypt_wcdb.py <db_path> <key_hex> [output_path]

示例:
    python3 decrypt_wcdb.py message_0.db 96a696f1... message_0_decrypted.db
"""

import sys
import hashlib
import hmac
from pathlib import Path

# WCDB V4 加密参数
PAGE_SIZE = 4096
RESERVE_SIZE = 80  # 16 bytes IV + 64 bytes HMAC
KEY_SIZE = 32
PBKDF_ITERATIONS = 256000
SALT_SIZE = 16


def pbkdf2_sha512(password: bytes, salt: bytes, iterations: int, dk_len: int) -> bytes:
    """PBKDF2-HMAC-SHA512 密钥派生"""
    return hashlib.pbkdf2_hmac('sha512', password, salt, iterations, dk_len)


def decrypt_page(page_data: bytes, key: bytes, page_num: int) -> bytes:
    """
    解密单个数据库页面

    注意: 这是简化版本，实际 SQLCipher 解密需要使用 AES-256-CBC
    完整解密建议使用 chatlog 或 pysqlcipher3
    """
    # SQLCipher 页面结构:
    # - 前 PAGE_SIZE - RESERVE_SIZE 字节: 加密数据
    # - 后 RESERVE_SIZE 字节: IV (16) + HMAC (64)

    if len(page_data) != PAGE_SIZE:
        return page_data

    encrypted_data = page_data[:PAGE_SIZE - RESERVE_SIZE]
    reserve = page_data[PAGE_SIZE - RESERVE_SIZE:]
    iv = reserve[:16]
    stored_hmac = reserve[16:80]

    # 实际解密需要 AES，这里只返回原数据
    # 建议使用 chatlog 进行完整解密
    return page_data


def decrypt_database(db_path: str, key_hex: str, output_path: str = None):
    """
    解密 WCDB 数据库

    参数:
        db_path: 加密数据库路径
        key_hex: 32字节密钥的十六进制字符串
        output_path: 输出路径（可选）
    """
    db_path = Path(db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"数据库不存在: {db_path}")

    # 转换密钥
    key = bytes.fromhex(key_hex)
    if len(key) != KEY_SIZE:
        raise ValueError(f"密钥长度必须是 {KEY_SIZE} 字节")

    # 读取数据库
    with open(db_path, 'rb') as f:
        db_data = f.read()

    if len(db_data) < PAGE_SIZE:
        raise ValueError("数据库文件太小")

    # 读取盐值（第一页的前16字节）
    salt = db_data[:SALT_SIZE]
    print(f"Salt: {salt.hex()}")

    # 派生加密密钥
    derived_key = pbkdf2_sha512(key, salt, PBKDF_ITERATIONS, 64)
    encryption_key = derived_key[:32]
    hmac_key = derived_key[32:64]

    print(f"Derived encryption key: {encryption_key.hex()}")
    print(f"Derived HMAC key: {hmac_key.hex()}")

    # 页面数量
    num_pages = len(db_data) // PAGE_SIZE
    print(f"Total pages: {num_pages}")

    # 注意: 完整解密需要实现 AES-256-CBC
    # 这里只提供密钥派生验证
    # 建议使用 chatlog server 进行完整解密

    print("\n[!] 完整解密请使用 chatlog:")
    print(f"chatlog server -d {db_path.parent} -k {key_hex} -p darwin -v 4")

    return {
        'salt': salt.hex(),
        'encryption_key': encryption_key.hex(),
        'hmac_key': hmac_key.hex(),
        'pages': num_pages
    }


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    db_path = sys.argv[1]
    key_hex = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        result = decrypt_database(db_path, key_hex, output_path)
        print("\n解密信息:")
        for k, v in result.items():
            print(f"  {k}: {v}")
    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
