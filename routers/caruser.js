const express = require('express');
const router = express.Router();
const multer = require('multer');
const asyncHandler = require('express-async-handler');
const Caruser = require('../models/Caruser');
const { verifyToken, verifyTokenAndAdmin } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

// إعداد multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// دالة الرفع لـ Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'cars_users', resource_type: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// 1. [POST] إضافة سيارة جديدة (تنتظر الموافقة تلقائياً)
router.post('/', verifyToken, upload.array('images', 5), asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "يرجى رفع صورة واحدة على الأقل" });
    }

    const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
    const imageUrls = await Promise.all(uploadPromises);

    const newCar = new Caruser({
        ...req.body,
        images: imageUrls,
        owner: req.user.id,
        isApproved: false // لضمان عدم ظهورها إلا بعد موافقة الأدمن
    });

    await newCar.save();
    res.status(201).json({ message: "تم إرسال طلب إضافة السيارة بنجاح، في انتظار موافقة الإدارة" });
}));

// 2. [GET] جلب السيارات "الموافق عليها فقط" للجمهور
router.get('/all-for-sale', asyncHandler(async (req, res) => {
    const cars = await Caruser.find({ isApproved: true }).sort({ createdAt: -1 });
    res.status(200).json(cars);
}));

// 3. [GET] جلب السيارات "المعلقة" (للأدمن فقط)
router.get('/admin/pending', verifyTokenAndAdmin, asyncHandler(async (req, res) => {
    const cars = await Caruser.find({ isApproved: false }).sort({ createdAt: -1 });
    res.status(200).json(cars);
}));

// 4. [PATCH] الموافقة على السيارة (للأدمن فقط)
router.patch('/approve/:id', verifyTokenAndAdmin, asyncHandler(async (req, res) => {
    const car = await Caruser.findByIdAndUpdate(
        req.params.id, 
        { isApproved: true }, 
        { new: true }
    );
    if (!car) return res.status(404).json({ message: "السيارة غير موجودة" });
    res.status(200).json({ message: "تمت الموافقة على السيارة وهي الآن معروضة للجميع" });
}));

// 5. [GET] سياراتي (للمستخدم العادي يرى سياراته حتى لو لم تُقبل بعد)
router.get('/my/cars', verifyToken, asyncHandler(async (req, res) => {
    const cars = await Caruser.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(cars);
}));

// 6. [GET] تفاصيل سيارة واحدة
router.get('/:id', asyncHandler(async (req, res) => {
    const car = await Caruser.findById(req.params.id);
    if (!car) return res.status(404).json({ message: "السيارة غير موجودة" });
    res.status(200).json(car);
}));

// 7. [DELETE] حذف سيارة (المالك أو الأدمن)
router.delete('/:id', verifyToken, asyncHandler(async (req, res) => {
    const car = await Caruser.findById(req.params.id);
    if (!car) return res.status(404).json({ message: "السيارة غير موجودة" });

    const isOwner = car.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "غير مسموح لك بحذف هذه السيارة" });
    }

    await Caruser.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "تم حذف السيارة بنجاح" });
}));

// 8. [PUT] تحديث سيارة
router.put('/:id', verifyToken, upload.array('images', 5), asyncHandler(async (req, res) => {
    let car = await Caruser.findById(req.params.id);
    if (!car) return res.status(404).json({ message: "السيارة غير موجودة" });

    if (car.owner.toString() !== req.user.id) {
        return res.status(403).json({ message: "غير مسموح لك بتعديل هذه السيارة" });
    }

    let imageUrls = car.images;
    if (req.files && req.files.length > 0) {
        const newImages = await Promise.all(req.files.map(file => uploadToCloudinary(file.buffer)));
        imageUrls = [...imageUrls, ...newImages];
    }

    const updatedCar = await Caruser.findByIdAndUpdate(
        req.params.id,
        { ...req.body, images: imageUrls, isApproved: false }, // إعادة طلب الموافقة عند التعديل الجوهري (اختياري)
        { new: true }
    );

    res.status(200).json(updatedCar);
}));

module.exports = router;