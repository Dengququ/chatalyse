import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const ERNIE_API_URL = 'https://qianfan.baidubce.com/v2/chat/completions';
const ERNIE_API_KEY = process.env.ERNIE_API_KEY || '';
const ERNIE_MODEL = process.env.ERNIE_MODEL || 'ernie-5.0-thinking-preview';

const SYSTEM_PROMPT = `你是一个专业的待办事项提取助手。你的任务是从用户提供的聊天记录中识别并提取待办事项。

请按以下JSON格式返回结果（只返回JSON，不要其他文字）：
{
  "todos": [
    {
      "content": "待办事项内容",
      "date": "截止日期（如有，格式如'明天 10:00'、'本周五'、'下周一'等，没有则为null）",
      "priority": "优先级（high/medium/low，根据紧急程度判断）",
      "category": "分类（work工作/study学习/life生活）"
    }
  ]
}

提取规则：
1. 只提取明确的待办事项，如"记得..."、"要..."、"别忘了..."、"@某人 请..."等
2. 忽略普通闲聊内容
3. 如果没有待办事项，返回空数组 {"todos": []}
4. 合理推断优先级：涉及deadline、紧急、重要的设为high；一般任务为medium；可选的设为low
5. 根据内容判断分类：工作相关→work，学习相关→study，生活琐事→life`;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { chatContent, source } = await request.json();

    if (!chatContent || chatContent.trim().length === 0) {
      return NextResponse.json({ error: '聊天内容不能为空' }, { status: 400 });
    }

    if (!ERNIE_API_KEY) {
      return NextResponse.json({ error: 'AI API未配置' }, { status: 500 });
    }

    // Call ERNIE API
    const response = await fetch(ERNIE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ERNIE_API_KEY}`,
      },
      body: JSON.stringify({
        model: ERNIE_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `请从以下聊天记录中提取待办事项：\n\n${chatContent}` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ERNIE API error:', errorText);
      return NextResponse.json({ error: 'AI分析失败' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let todos = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        todos = parsed.todos || [];

        // Add source info to each todo
        todos = todos.map((todo: any) => ({
          ...todo,
          source: source || '聊天分析',
        }));
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json({
        error: '解析AI响应失败',
        raw: content
      }, { status: 500 });
    }

    return NextResponse.json({
      todos,
      message: `成功提取 ${todos.length} 个待办事项`
    });

  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: '分析失败: ' + error.message }, { status: 500 });
  }
}
