const mongoose = require('mongoose');

const caruserSchema = new mongoose.Schema({
  images: { type: [String], required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  type: { type: String, enum: ['Sale', 'Rent'], required: true },
  status: { type: String },
  kilometers: { type: Number },
  addedDate: { type: Date, default: Date.now },
  factoryCondition: { type: String },
  doors: { type: Number },
  modification: { type: String },
  horsepower: { type: Number },
  engineCapacity: { type: Number },
  fuelType: { type: String },
  transmission: { type: String },
  year: { type: Number },
  color: { type: String },
  features: { type: [String] },
  // نظام الموافقة (جديد)
  isApproved: { type: Boolean, default: false }, 
  // بيانات المالك
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerName: { type: String, required: true },
  ownerPhone: { type: String, required: true },
  ownerEmail: { type: String },
  ownerAddress: { type: Object }
}, { timestamps: true });

module.exports = mongoose.model('Caruser', caruserSchema);