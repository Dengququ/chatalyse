/**
 * frida-trace 自定义 handler
 *
 * 使用方法:
 *   1. 运行 frida-trace -p <PID> -i "CCKeyDerivationPBKDF"
 *   2. 将此文件内容复制到生成的 handler 文件:
 *      __handlers__/libcommonCrypto.dylib/CCKeyDerivationPBKDF.js
 *   3. 重新运行 frida-trace
 */

{
  onEnter(log, args, state) {
    // CCKeyDerivationPBKDF 参数 (ARM64 调用约定):
    // x0 (args[0]): algorithm
    // x1 (args[1]): password
    // x2 (args[2]): passwordLen
    // x3 (args[3]): salt
    // x4 (args[4]): saltLen
    // x5 (args[5]): prf
    // x6 (args[6]): rounds
    // x7 (args[7]): derivedKey
    // stack (args[8]): derivedKeyLen

    const algorithm = args[0].toInt32();
    const passwordPtr = args[1];
    const passwordLen = args[2].toInt32();
    const saltPtr = args[3];
    const saltLen = args[4].toInt32();
    const prf = args[5].toInt32();
    const rounds = args[6].toInt32();
    const derivedKeyLen = args[8].toInt32();

    // 只关注 WCDB 特征的调用
    if (algorithm === 2 && passwordLen === 32 && rounds >= 64000) {
      log('');
      log('========================================');
      log('[+] WCDB Key Derivation Detected!');
      log('========================================');
      log(`Algorithm: ${algorithm} (PBKDF2)`);
      log(`Password Length: ${passwordLen}`);
      log(`Salt Length: ${saltLen}`);
      log(`PRF: ${prf} (${prf === 5 ? 'SHA512' : 'Other'})`);
      log(`Rounds: ${rounds}`);
      log(`Derived Key Length: ${derivedKeyLen}`);

      // 读取密码（原始密钥）
      if (passwordLen > 0 && passwordLen <= 64) {
        try {
          const passwordBytes = passwordPtr.readByteArray(passwordLen);
          const passwordHex = Array.from(new Uint8Array(passwordBytes))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

          log('');
          log('[!!!] RAW KEY CAPTURED: ' + passwordHex);
          log('[!!!] Key Length: ' + passwordLen + ' bytes');

          // 尝试保存到文件
          try {
            const file = new File('/tmp/wechat_key.txt', 'w');
            file.write(passwordHex + '\n');
            file.close();
            log('[+] Key saved to /tmp/wechat_key.txt');
          } catch (e) {
            log('[!] Could not save to file: ' + e.message);
          }
        } catch (e) {
          log('[!] Error reading password: ' + e.message);
        }
      }

      // 读取盐值
      if (saltLen > 0 && saltLen <= 32) {
        try {
          const saltBytes = saltPtr.readByteArray(saltLen);
          const saltHex = Array.from(new Uint8Array(saltBytes))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          log(`Salt: ${saltHex}`);
        } catch (e) {
          // 忽略
        }
      }

      log('========================================');
      log('');
    }

    // 保存状态用于 onLeave
    state.algorithm = algorithm;
    state.passwordLen = passwordLen;
    state.rounds = rounds;
    state.derivedKeyPtr = args[7];
    state.derivedKeyLen = derivedKeyLen;
  },

  onLeave(log, retval, state) {
    // 可选：在函数返回后读取派生密钥
    if (state.algorithm === 2 && state.passwordLen === 32 && state.rounds >= 64000) {
      try {
        const derivedKeyBytes = state.derivedKeyPtr.readByteArray(state.derivedKeyLen);
        const derivedKeyHex = Array.from(new Uint8Array(derivedKeyBytes))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        log(`Derived Key: ${derivedKeyHex}`);
      } catch (e) {
        // 忽略
      }
    }
  }
}
