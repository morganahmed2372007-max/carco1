const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { verifyToken, verifyTokenAndAdmin } = require('../middleware/auth');

/**
 * @desc    تسجيل دخول (مع التحقق من الحظر)
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    // 🛑 منع المستخدم من الدخول إذا كان محظوراً
    if (user.isBlocked) {
      return res.status(403).json({ message: 'عذراً، هذا الحساب محظور حالياً من قبل الإدارة' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '8d' });
    const { password: _, ...userResponse } = user.toObject();

    res.status(200).json({ user: userResponse, token });
  })
);

/**
 * @desc    جلب كل المستخدمين
 */
router.get(
  '/',
  verifyTokenAndAdmin,
  asyncHandler(async (req, res) => {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  })
);

/**
 * @desc    حظر أو إلغاء حظر مستخدم (Toggle Block)
 * @route   PATCH /api/users/block/:id
 */
router.patch(
  '/block/:id',
  verifyTokenAndAdmin,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // منع الأدمن من حظر نفسه
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'لا يمكنك حظر حسابك الشخصي' });
    }

    // تبديل حالة الحظر
    user.isBlocked = !user.isBlocked;
    await user.save();

    res.status(200).json({ 
      success: true, 
      message: user.isBlocked ? 'تم حظر المستخدم بنجاح' : 'تم إلغاء حظر المستخدم بنجاح',
      isBlocked: user.isBlocked 
    });
  })
);

module.exports = router;