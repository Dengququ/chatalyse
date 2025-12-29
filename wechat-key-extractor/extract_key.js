/**
 * WeChat macOS Key Extractor
 * 使用 Frida hook CCKeyDerivationPBKDF 函数提取 WCDB 数据库密钥
 *
 * 使用方法:
 *   frida -p <WeChat_PID> -l extract_key.js
 */

'use strict';

// 算法常量
const kCCPBKDF2 = 2;
const PRF_NAMES = {
    1: 'SHA1',
    2: 'SHA224',
    3: 'SHA256',
    4: 'SHA384',
    5: 'SHA512'
};

// 存储捕获的密钥
const capturedKeys = new Set();

// 将字节数组转换为十六进制字符串
function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += ('0' + bytes[i].toString(16)).slice(-2);
    }
    return hex;
}

// 读取内存中的字节
function readBytes(ptr, length) {
    const bytes = [];
    for (let i = 0; i < length; i++) {
        bytes.push(ptr.add(i).readU8());
    }
    return bytes;
}

// Hook CCKeyDerivationPBKDF
function hookCCKeyDerivationPBKDF() {
    const CCKeyDerivationPBKDF = Module.findExportByName('libcommonCrypto.dylib', 'CCKeyDerivationPBKDF');

    if (!CCKeyDerivationPBKDF) {
        console.log('[!] CCKeyDerivationPBKDF not found');
        return;
    }

    console.log('[*] Hooking CCKeyDerivationPBKDF at ' + CCKeyDerivationPBKDF);

    Interceptor.attach(CCKeyDerivationPBKDF, {
        onEnter: function(args) {
            // CCKeyDerivationPBKDF 参数:
            // arg0: algorithm (CCPBKDFAlgorithm)
            // arg1: password (const char *)
            // arg2: passwordLen (size_t)
            // arg3: salt (const uint8_t *)
            // arg4: saltLen (size_t)
            // arg5: prf (CCPseudoRandomAlgorithm)
            // arg6: rounds (uint)
            // arg7: derivedKey (uint8_t *)
            // arg8: derivedKeyLen (size_t)

            this.algorithm = args[0].toInt32();
            this.passwordPtr = args[1];
            this.passwordLen = args[2].toInt32();
            this.saltPtr = args[3];
            this.saltLen = args[4].toInt32();
            this.prf = args[5].toInt32();
            this.rounds = args[6].toInt32();
            this.derivedKeyPtr = args[7];
            this.derivedKeyLen = args[8].toInt32();

            // 只关注 PBKDF2 且密钥长度为 32 字节的调用 (WCDB 特征)
            if (this.algorithm === kCCPBKDF2 && this.derivedKeyLen === 32 && this.rounds >= 64000) {
                console.log('\n[+] CCKeyDerivationPBKDF called!');
                console.log('    Algorithm: ' + this.algorithm + ' (PBKDF2)');
                console.log('    Password Length: ' + this.passwordLen);
                console.log('    Salt Length: ' + this.saltLen);
                console.log('    PRF: ' + this.prf + ' (' + (PRF_NAMES[this.prf] || 'Unknown') + ')');
                console.log('    Rounds: ' + this.rounds);
                console.log('    Derived Key Length: ' + this.derivedKeyLen);

                // 读取密码（原始密钥）
                if (this.passwordLen > 0 && this.passwordLen <= 64) {
                    try {
                        const passwordBytes = readBytes(this.passwordPtr, this.passwordLen);
                        const passwordHex = bytesToHex(passwordBytes);

                        if (!capturedKeys.has(passwordHex)) {
                            capturedKeys.add(passwordHex);
                            console.log('\n[!!!] RAW KEY CAPTURED: ' + passwordHex);
                            console.log('[!!!] Key Length: ' + this.passwordLen + ' bytes');

                            // 保存到文件
                            const file = new File('/tmp/wechat_key.txt', 'w');
                            file.write(passwordHex + '\n');
                            file.close();
                            console.log('[+] Key saved to /tmp/wechat_key.txt');
                        }
                    } catch (e) {
                        console.log('[!] Error reading password: ' + e);
                    }
                }

                // 读取盐值
                if (this.saltLen > 0 && this.saltLen <= 32) {
                    try {
                        const saltBytes = readBytes(this.saltPtr, this.saltLen);
                        console.log('    Salt: ' + bytesToHex(saltBytes));
                    } catch (e) {
                        console.log('[!] Error reading salt: ' + e);
                    }
                }
            }
        },

        onLeave: function(retval) {
            // 可选：读取派生后的密钥
            if (this.algorithm === kCCPBKDF2 && this.derivedKeyLen === 32 && this.rounds >= 64000) {
                try {
                    const derivedKeyBytes = readBytes(this.derivedKeyPtr, this.derivedKeyLen);
                    console.log('    Derived Key: ' + bytesToHex(derivedKeyBytes));
                } catch (e) {
                    // 忽略
                }
            }
        }
    });

    console.log('[*] Hook installed. Waiting for WeChat to access database...');
    console.log('[*] Try opening a chat or refreshing the contact list.');
}

// 主函数
function main() {
    console.log('='.repeat(60));
    console.log('WeChat macOS Key Extractor');
    console.log('='.repeat(60));
    console.log('[*] Target Process: ' + Process.id);
    console.log('[*] Platform: ' + Process.platform);
    console.log('[*] Architecture: ' + Process.arch);
    console.log('');

    hookCCKeyDerivationPBKDF();
}

// 运行
main();
