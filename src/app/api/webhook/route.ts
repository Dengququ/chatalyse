import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Todo from '@/models/Todo';

const ERNIE_API_URL = 'https://qianfan.baidubce.com/v2/chat/completions';
const ERNIE_API_KEY = process.env.ERNIE_API_KEY || '';
const ERNIE_MODEL = process.env.ERNIE_MODEL || 'ernie-5.0-thinking-preview';

// Webhook secret for verification (optional)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

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

// Analyze chat content with AI
async function analyzeWithAI(content: string, source: string) {
  if (!ERNIE_API_KEY) {
    console.error('ERNIE API key not configured');
    return [];
  }

  try {
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
          { role: 'user', content: `请从以下聊天记录中提取待办事项：\n\n${content}` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('ERNIE API error:', await response.text());
      return [];
    }

    const data = await response.json();
    const responseContent = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.todos || []).map((todo: any) => ({
        ...todo,
        source: source,
      }));
    }
  } catch (error) {
    console.error('AI analysis error:', error);
  }

  return [];
}

// POST - Receive webhook from wechat-log
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify webhook secret
    const authHeader = request.headers.get('authorization');
    if (WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      console.log('Webhook: Invalid authorization');
      // Still process but log warning
    }

    const body = await request.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // wechat-log webhook format:
    // {
    //   "talker": "wxid_xxx",
    //   "sender": "wxid_xxx",
    //   "keyword": "",
    //   "lastTime": "2025-01-01 00:00:00",
    //   "length": 1,
    //   "messages": [
    //     {
    //       "seq": 1234567890,
    //       "time": "2025-01-01T00:00:00+08:00",
    //       "talker": "wxid_xxx",
    //       "talkerName": "群名/联系人名",
    //       "isChatRoom": false,
    //       "sender": "wxid_xxx",
    //       "senderName": "发送人名",
    //       "isSelf": false,
    //       "type": 1,
    //       "content": "消息内容",
    //       "contents": {}
    //     }
    //   ]
    // }

    const { messages, talker } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ message: 'No messages to process' });
    }

    // Combine messages into chat content
    const chatContent = messages
      .filter((msg: any) => msg.type === 1) // Only text messages
      .map((msg: any) => `${msg.senderName || msg.sender}: ${msg.content}`)
      .join('\n');

    if (!chatContent.trim()) {
      return NextResponse.json({ message: 'No text content to analyze' });
    }

    // Determine source name
    const sourceName = messages[0]?.talkerName || talker || '微信';

    // Analyze with AI
    const todos = await analyzeWithAI(chatContent, sourceName);

    if (todos.length === 0) {
      return NextResponse.json({
        message: 'No todos found',
        analyzed: true
      });
    }

    // Save todos to database
    // Note: For webhook, we need a default user or system user
    // You might want to configure this based on your needs
    await dbConnect();

    // Try to find the first user (or create a system user)
    const User = (await import('@/models/User')).default;
    let user = await User.findOne({});

    if (!user) {
      console.log('Webhook: No user found, skipping save');
      return NextResponse.json({
        message: 'Todos extracted but no user to save to',
        todos: todos,
      });
    }

    // Save each todo
    const savedTodos = [];
    for (const todo of todos) {
      const saved = await Todo.create({
        userId: user._id,
        content: todo.content,
        date: todo.date,
        priority: todo.priority || 'medium',
        category: todo.category || 'work',
        source: todo.source,
        appId: 'app_1',
        sessionId: 'webhook_session',
        done: false,
      });
      savedTodos.push(saved);
    }

    console.log(`Webhook: Saved ${savedTodos.length} todos`);

    return NextResponse.json({
      message: `Successfully extracted and saved ${savedTodos.length} todos`,
      todos: savedTodos,
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed: ' + error.message },
      { status: 500 }
    );
  }
}

// GET - Health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook endpoint ready',
    timestamp: new Date().toISOString(),
  });
}
