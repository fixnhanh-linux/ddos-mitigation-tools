import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Simplified User schema just for seeding
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin", "author", "editor"], default: "user" },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

const MONGODB_URI = "mongodb://127.0.0.1:27017/web-blogs";

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const email = "admin@example.com";
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log(`User ${email} already exists. Deleting...`);
      await User.deleteOne({ email });
    }

    const hashedPassword = await bcrypt.hash("123456", 10);
    const newUser = new User({
      name: "Admin User",
      email: email,
      password: hashedPassword,
      role: "admin",
    });

    await newUser.save();
    console.log(`Created new admin user: ${email} with password: 123456`);

  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

seed();
