import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITodo extends Document {
  userId: mongoose.Types.ObjectId;
  content: string;
  date?: string;
  priority: 'high' | 'medium' | 'low';
  category: 'work' | 'study' | 'life';
  source?: string;
  sessionId?: string;
  appId?: string;
  done: boolean;
  context?: string;
  createdAt: Date;
}

const TodoSchema = new Schema<ITodo>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  date: { type: String },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  category: { type: String, enum: ['work', 'study', 'life'], default: 'work' },
  source: { type: String },
  sessionId: { type: String },
  appId: { type: String },
  done: { type: Boolean, default: false },
  context: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const Todo: Model<ITodo> = mongoose.models.Todo || mongoose.model<ITodo>('Todo', TodoSchema);

export default Todo;
