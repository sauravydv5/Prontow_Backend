import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import responseHandler from "../utils/responseHandler.js";

export const sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber)
      return res
        .status(400)
        .json(responseHandler.error("Phone number is required"));

    const otp = parseInt(process.env.OTP);
    console.log(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    let user = await User.findOne({
      phoneNumber: {
        $regex: new RegExp(`${phoneNumber}$`, 'i')
      }
    });

    if (!user) {
      user = await User.create({
        phoneNumber,
        otp,
        otpExpiresAt: expiresAt,
      });
    } else {
      user.otp = otp;
      user.otpExpiresAt = expiresAt;
      await user.save();
    }

    console.log(`OTP for ${phoneNumber}: ${otp}`);

    return res.json(
      responseHandler.success(
        { otp, isNew: user.isNew },
        "OTP sent successfully"
      )
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp)
      return res
        .status(400)
        .json(responseHandler.error("Phone number and OTP are required"));

    const user = await User.findOne({ phoneNumber });
    if (!user || !user.otp)
      return res.status(400).json(responseHandler.error("OTP not generated"));

    if (Date.now() > new Date(user.otpExpiresAt).getTime())
      return res.status(400).json(responseHandler.error("OTP expired"));

    if (parseInt(otp) !== user.otp)
      return res.status(400).json(responseHandler.error("Invalid OTP"));

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.isPhoneVerified = true;
    user.isNew = false;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json(
      responseHandler.success({ user, token }, "OTP verified successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};


export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: "admin" });
    if (!user)
      return res.status(400).json(responseHandler.error("Admin not found"));

    const isCorrect = bcrypt.compareSync(password, user.password);
    if (!isCorrect)
      return res.status(400).json(responseHandler.error("Invalid credentials"));


    req.body.phoneNumber = user.phoneNumber;
    sendOtp(req, res);
    
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
}

export const adminForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email, role: "admin" });

    if (!user) {
      return res
        .status(404)
        .json(responseHandler.error("Admin with this email does not exist"));
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // TODO: integrate email/SMS delivery

    return res.json(
      responseHandler.success(
        {
          resetToken,
          expiresAt: user.resetPasswordExpiresAt,
        },
        "Password reset token generated successfully"
      )
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};