const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isBlocked: { type: Boolean, default: false } // الحقل الجديد للحظر
}, { timestamps: true });

// 🔒 Pre-save hook لتشفير الباسورد
// شيلنا الـ next من هنا لأننا بنستخدم async
userSchema.pre('save', async function() {
  // لو الباسورد متغيرش، اخرج من الفانكشن (Return)
  if (!this.isModified('password')) return;

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    // مش محتاجين ننادي على next() هنا
  } catch (err) {
    // في حالة الخطأ بنعمل throw وهو هيلقطه لوحده
    throw err;
  }
});

// ✅ Method للتحقق من الباسورد عند تسجيل الدخول
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);