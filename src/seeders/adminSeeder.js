import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "../models/user.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("Admin user already exists:", existingAdmin.email);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    const admin = new User({
      firstName: "Super",
      lastName: "Admin",
      email: "admin@example.com",
      phoneNumber: "9999999999",
      password: hashedPassword,
      role: "admin",
      isPhoneVerified: true,
      isEmailVerified: true,
      isNew: false,
      lastLogin: new Date(),
    });

    await admin.save();
    console.log("✅ Admin user created successfully!");
    console.log("Email:", admin.email);
    console.log("Password: Admin@123");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();
