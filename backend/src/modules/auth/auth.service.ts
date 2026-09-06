import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";

interface RegisterInput {
  businessName: string;
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  phone?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

function createToken(user: {
  id: string;
  businessId: string;
  role: string;
}) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
    },
    jwtSecret,
    {
      expiresIn: "7d",
    },
  );
}

export async function registerBusiness(input: RegisterInput) {
  const {
    businessName,
    firstName,
    lastName,
    email,
    password,
    phone,
  } = input;

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
    },
  });

  if (existingUser) {
    throw new Error("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: businessName.trim(),
        phone: phone?.trim(),
      },
    });

    const user = await tx.user.create({
      data: {
        businessId: business.id,
        email: normalizedEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName?.trim(),
        role: "OWNER",
      },
    });

    return { business, user };
  });

  const token = createToken(result.user);

  return {
    token,
    user: {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role,
    },
    business: {
      id: result.business.id,
      name: result.business.name,
      country: result.business.country,
      currency: result.business.currency,
    },
  };
}

export async function loginUser(input: LoginInput) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      isActive: true,
    },
    include: {
      business: true,
    },
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const passwordValid = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!passwordValid) {
    throw new Error("Invalid email or password");
  }

  const token = createToken(user);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    business: {
      id: user.business.id,
      name: user.business.name,
      country: user.business.country,
      currency: user.business.currency,
    },
  };
}
