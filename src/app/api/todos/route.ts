import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Todo from '@/models/Todo';

// GET - 获取用户所有待办
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    await dbConnect();

    const todos = await Todo.find({ userId: (session.user as any).id })
      .sort({ createdAt: -1 });

    return NextResponse.json({ todos });
  } catch (error) {
    console.error('Get todos error:', error);
    return NextResponse.json({ error: '获取待办失败' }, { status: 500 });
  }
}

// POST - 创建新待办
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { content, date, priority, category, source, sessionId, appId, context } = body;

    if (!content) {
      return NextResponse.json({ error: '待办内容不能为空' }, { status: 400 });
    }

    await dbConnect();

    const todo = await Todo.create({
      userId: (session.user as any).id,
      content,
      date,
      priority: priority || 'medium',
      category: category || 'work',
      source,
      sessionId,
      appId,
      context,
      done: false,
    });

    return NextResponse.json({ todo }, { status: 201 });
  } catch (error) {
    console.error('Create todo error:', error);
    return NextResponse.json({ error: '创建待办失败' }, { status: 500 });
  }
}

// PATCH - 更新待办
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少待办ID' }, { status: 400 });
    }

    await dbConnect();

    const todo = await Todo.findOneAndUpdate(
      { _id: id, userId: (session.user as any).id },
      { $set: updates },
      { new: true }
    );

    if (!todo) {
      return NextResponse.json({ error: '待办不存在' }, { status: 404 });
    }

    return NextResponse.json({ todo });
  } catch (error) {
    console.error('Update todo error:', error);
    return NextResponse.json({ error: '更新待办失败' }, { status: 500 });
  }
}

// DELETE - 删除待办
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少待办ID' }, { status: 400 });
    }

    await dbConnect();

    const result = await Todo.deleteOne({
      _id: id,
      userId: (session.user as any).id,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: '待办不存在' }, { status: 404 });
    }

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete todo error:', error);
    return NextResponse.json({ error: '删除待办失败' }, { status: 500 });
  }
}
