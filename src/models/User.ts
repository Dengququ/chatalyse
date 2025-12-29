import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password?: string;
  name?: string;
  avatar?: string;
  wechatOpenId?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  name: { type: String },
  avatar: { type: String },
  wechatOpenId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
