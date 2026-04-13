const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { verifyToken, verifyTokenAndAdmin } = require('../middleware/auth');

/**
 * @desc    إنشاء حساب جديد (Register)
 * @route   POST /api/users/register
 */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body; // غير name لـ fullName

    // 1. التأكد من إدخال جميع الحقول المطلوبة
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'يرجى إدخال جميع الحقول: الاسم، البريد، وكلمة المرور' });
    }

    // 2. التحقق هل المستخدم موجود مسبقاً؟
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'هذا البريد الإلكتروني مسجل بالفعل، حاول تسجيل الدخول' });
    }

    // 3. إنشاء المستخدم (تأكد أن الـ Model يقوم بتشفير الباسورد تلقائياً)
    const user = await User.create({
      fullName,
      email,
      password,
    });

    if (user) {
      // 4. توليد التوكن للمستخدم الجديد
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '365d' }
      );

      // 5. إرسال البيانات بدون كلمة المرور
      const { password: _, ...userResponse } = user.toObject();
      res.status(201).json({
        message: 'تم إنشاء الحساب بنجاح',
        user: userResponse,
        token
      });
    } else {
      res.status(400).json({ message: 'حدث خطأ أثناء إنشاء الحساب، بيانات غير صالحة' });
    }
  })
);

/**
 * @desc    تسجيل دخول (Login)
 * @route   POST /api/users/login
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

    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET || 'secret', 
     // 365 يوم (سنة كاملة)
{ expiresIn: '365d' }
    );

    const { password: _, ...userResponse } = user.toObject();
    res.status(200).json({ user: userResponse, token });
  })
);

/**
 * @desc    جلب كل المستخدمين (للمسؤول فقط)
 * @route   GET /api/users
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

    // منع المسؤول من حظر نفسه
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