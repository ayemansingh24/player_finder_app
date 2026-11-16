import fs from "fs";
import { User } from "../models/user.model.js";
import cloudinary from "../../../utils/cloudinary.js";

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Old password and new password are required",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Old password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong while changing password",
      error: error.message,
    });
  }
};

const updateAccountDetails = async (req, res) => {
  try {
    const { fullName, email } = req.body;

    if (!fullName && !email) {
      return res.status(400).json({
        message: "At least one field is required",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (fullName) {
      user.fullName = fullName;
    }

    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        return res.status(409).json({
          message: "Email already in use",
        });
      }

      user.email = email;
    }

    await user.save();

    const updatedUser = await User.findById(req.user._id).select(
      "-password -refreshToken"
    );

    return res.status(200).json({
      message: "Account details updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong while updating account details",
      error: error.message,
    });
  }
};

const updateUserAvatar = async (req, res) => {
  try {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
      return res.status(400).json({
        message: "Avatar file is required",
      });
    }

    const uploadResult = await cloudinary.uploader.upload(avatarLocalPath, {
      resource_type: "image",
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          avatar: {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password -refreshToken");

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    fs.unlinkSync(avatarLocalPath);

    return res.status(200).json({
      message: "Avatar updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong while updating avatar",
      error: error.message,
    });
  }
};

const deleteUserAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const publicId = user.avatar?.publicId;
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }

    user.avatar = {
      url: "default-avatar",
    };

    await user.save();

    return res.status(200).json({
      message: "Avatar deleted successfully",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong while deleting avatar",
      error: error.message,
    });
  }
};

export { changePassword, updateAccountDetails, updateUserAvatar, deleteUserAvatar };
