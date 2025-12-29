import { NextRequest, NextResponse } from 'next/server';

// 中文停用词
const stopWords = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '这', '那', '他', '她', '它', '们', '什么', '还', '可以', '吗', '啊', '呢', '吧',
  '嗯', '哦', '哈', '呀', '哎', '唉', '嘿', '哇', '噢', '嗷', '但', '而', '或',
  '没', '个', '来', '这么', '那么', '几', '太', '能', '该', '给', '跟', '用',
  '图片', '表情', '语音', '视频', '文件'
]);

// 解析chatlog消息，只提取纯消息内容
function extractMessages(rawText: string): string[] {
  const lines = rawText.split('\n');
  const messages: string[] = [];

  // 消息头模式：任意字符(wxid_xxx) MM-DD HH:MM:SS
  const isMessageHeader = (line: string): boolean => {
    return /\(wxid_[a-zA-Z0-9]+\)\s+\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(line);
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 如果当前行是消息头
    if (isMessageHeader(line)) {
      i++; // 移动到下一行（消息内容）

      // 收集消息内容（可能多行）
      while (i < lines.length && !isMessageHeader(lines[i]) && lines[i].trim()) {
        const contentLine = lines[i].trim();

        // 跳过：图片、表情、引用消息头
        if (contentLine.startsWith('![') ||
            contentLine.startsWith('[图片]') ||
            contentLine.startsWith('[表情]') ||
            contentLine.startsWith('[动画表情]') ||
            contentLine.startsWith('[语音]') ||
            contentLine.startsWith('[视频]') ||
            (contentLine.startsWith('>') && isMessageHeader(contentLine.substring(1).trim()))) {
          i++;
          continue;
        }

        // 清理引用前缀
        let cleanContent = contentLine;
        if (cleanContent.startsWith('> ')) {
          cleanContent = cleanContent.substring(2);
        }

        // 只添加有实际中文内容的消息
        if (/[\u4e00-\u9fa5]/.test(cleanContent)) {
          messages.push(cleanContent);
        }

        i++;
      }
    } else {
      i++;
    }
  }

  return messages;
}

// 提取中文词汇
function extractChineseWords(text: string): string[] {
  const words: string[] = [];

  // 只提取连续的中文字符串
  const matches = text.match(/[\u4e00-\u9fa5]+/g) || [];

  for (const match of matches) {
    if (match.length < 2) continue;

    // 直接添加2-4字的词组
    if (match.length <= 4) {
      words.push(match);
    } else {
      // 长文本切分成2-4字词组
      for (let len = 2; len <= 4; len++) {
        for (let start = 0; start <= match.length - len; start++) {
          words.push(match.substring(start, start + len));
        }
      }
    }
  }

  return words;
}

// 计算词频
function calculateFrequency(messages: string[], limit: number): { text: string; value: number }[] {
  const freq: Map<string, number> = new Map();

  for (const msg of messages) {
    const words = extractChineseWords(msg);
    for (const word of words) {
      if (stopWords.has(word)) continue;
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }

  // 只保留出现2次以上的词
  return Array.from(freq.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([text, value]) => ({ text, value }));
}

export async function POST(req: NextRequest) {
  try {
    const { chatContent, limit = 100 } = await req.json();

    if (!chatContent) {
      return NextResponse.json({ error: '缺少聊天内容' }, { status: 400 });
    }

    const messages = extractMessages(chatContent);
    const words = calculateFrequency(messages, limit);

    return NextResponse.json({
      success: true,
      words,
      total: words.reduce((sum, w) => sum + w.value, 0),
      messageCount: messages.length
    });
  } catch (error: any) {
    console.error('词云生成错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
