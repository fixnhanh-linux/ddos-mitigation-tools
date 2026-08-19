import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== "super-admin" && role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    
    let query: any = {};
    if (type === 'staff') {
      query = { role: { $ne: 'user' } };
    } else if (type === 'customers') {
      query = { role: 'user' };
    }

    // Exclude password from the results
    const users = await User.find(query).select("-password").sort({ createdAt: -1 });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const adminRole = (session?.user as any)?.role;
  if (!session || (adminRole !== "super-admin" && adminRole !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const { userId, newRole, status, password, name, email, phone, bio, avatar, isVerified } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Thiếu thông tin người dùng" }, { status: 400 });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: "User không tồn tại" }, { status: 404 });
    }

    if (isVerified !== undefined) {
      targetUser.isVerified = isVerified;
    }

    // Protect self-ban/self-demote
    // Check if the target user is the current logged-in user
    const adminEmail = (session?.user as any)?.email;
    const isSelf = targetUser.email === adminEmail;

    // Bảo vệ logic phân cấp quyền:
    // Admin thường không thể sửa Admin khác hoặc Super Admin (trừ tự sửa chính mình)
    if (!isSelf && adminRole === "admin" && (targetUser.role === "admin" || targetUser.role === "super-admin")) {
      return NextResponse.json({ error: "Bạn không có quyền sửa tài khoản ngang hàng hoặc cao hơn" }, { status: 403 });
    }
    
    if (isSelf && (status === "banned" || (newRole && newRole !== targetUser.role))) {
      return NextResponse.json({ error: "Bạn không thể tự khóa tài khoản hoặc tự đổi quyền của chính mình!" }, { status: 403 });
    }

    // Admin và Super Admin không thể bị khóa tài khoản (banned)
    if (status === "banned" && (targetUser.role === "admin" || targetUser.role === "super-admin")) {
      return NextResponse.json({ error: "Không thể khóa tài khoản của Admin hoặc Super Admin!" }, { status: 403 });
    }

    // Check email uniqueness if email is changed
    if (email && email !== targetUser.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return NextResponse.json({ error: "Email này đã được sử dụng" }, { status: 400 });
      }
      targetUser.email = email;
    }

    // update fields if provided
    if (name) targetUser.name = name;
    if (phone !== undefined) targetUser.phone = phone;
    if (bio !== undefined) targetUser.bio = bio;
    if (avatar !== undefined) targetUser.avatar = avatar;

    if (newRole) {
      if (!["super-admin", "admin", "editor", "author", "user"].includes(newRole)) {
        return NextResponse.json({ error: "Role không hợp lệ" }, { status: 400 });
      }
      
      // Admin không thể thăng cấp ai đó lên Admin hoặc Super Admin
      if (adminRole === "admin" && (newRole === "admin" || newRole === "super-admin")) {
        return NextResponse.json({ error: "Bạn không thể cấp quyền ngang hàng hoặc cao hơn" }, { status: 403 });
      }
      
      targetUser.role = newRole;
    }
    if (status) {
      targetUser.status = status;
    }
    
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, { status: 400 });
      }
      targetUser.password = await bcrypt.hash(password, 12);
    }

    await targetUser.save();

    return NextResponse.json({ message: "Cập nhật thành công", user: targetUser });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const adminRole = (session?.user as any)?.role;
  
  // Only Admin or Super Admin can create users
  if (!session || (adminRole !== "super-admin" && adminRole !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const { name, email, password, role, phone, bio, status, avatar } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Vui lòng nhập đầy đủ thông tin" }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "Email này đã được sử dụng" }, { status: 400 });
    }
    
    if (password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, { status: 400 });
    }
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "user",
      phone: phone || "",
      bio: bio || "",
      status: status || "active",
      avatar: avatar || ""
    });

    const userObj = newUser.toObject();
    delete userObj.password;

    return NextResponse.json({ message: "Tạo người dùng thành công", user: userObj }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const adminRole = (session?.user as any)?.role;
  if (!session || (adminRole !== "super-admin" && adminRole !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Thiếu thông tin người dùng" }, { status: 400 });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: "User không tồn tại" }, { status: 404 });
    }

    // Protect self-deletion
    const adminEmail = (session?.user as any)?.email;
    if (targetUser.email === adminEmail) {
      return NextResponse.json({ error: "Bạn không thể tự xóa tài khoản của chính mình!" }, { status: 403 });
    }

    // Role hierarchy check:
    // Admin cannot delete other Admins or Super Admins
    if (adminRole === "admin" && (targetUser.role === "admin" || targetUser.role === "super-admin")) {
      return NextResponse.json({ error: "Bạn không có quyền xóa tài khoản ngang hàng hoặc cao hơn" }, { status: 403 });
    }

    await User.findByIdAndDelete(userId);

    return NextResponse.json({ message: "Xóa người dùng thành công" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}

