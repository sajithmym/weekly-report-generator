import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { UserRole } from "../common/enums";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const createService = () => {
    const prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    return { service: new UsersService(prisma as never), prisma };
  };

  it("paginates user search with role and active-state filters", async () => {
    const { service, prisma } = createService();
    const users = [{ id: "user-1", email: "member@example.com" }];
    prisma.user.findMany.mockResolvedValue(users);
    prisma.user.count.mockResolvedValue(2);

    await expect(
      service.findAll({
        page: 2,
        limit: 1,
        search: " Member ",
        role: UserRole.TEAM_MEMBER,
        isActive: false,
      }),
    ).resolves.toMatchObject({
      data: users,
      meta: { page: 2, limit: 1, total: 2, totalPages: 2 },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: UserRole.TEAM_MEMBER,
          isActive: false,
          OR: [
            { name: { contains: "Member", mode: "insensitive" } },
            { email: { contains: "Member", mode: "insensitive" } },
          ],
        },
        skip: 1,
        take: 1,
      }),
    );
  });

  it("creates a normalized user without returning the password hash", async () => {
    const { service, prisma } = createService();
    const created = { id: "user-1", email: "new@example.com", isActive: true };
    prisma.user.create.mockResolvedValue(created);

    await expect(
      service.create({
        name: "  New User  ",
        email: " NEW@EXAMPLE.COM ",
        password: "password123",
      }),
    ).resolves.toBe(created);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "New User",
          email: "new@example.com",
          role: UserRole.TEAM_MEMBER,
          passwordHash: expect.any(String),
        }),
      }),
    );
    expect(prisma.user.create.mock.calls[0][0].select.passwordHash).toBeUndefined();
  });

  it("returns a conflict instead of an internal error for a duplicate email", async () => {
    const { service, prisma } = createService();
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      service.create({
        name: "Existing User",
        email: "existing@example.com",
        password: "password123",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns a user by id and rejects a missing user", async () => {
    const { service, prisma } = createService();
    const user = { id: "user-1", email: "member@example.com" };
    prisma.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(null);

    await expect(service.findById(user.id)).resolves.toBe(user);
    await expect(service.findById("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates a user's role and active state after verifying the user exists", async () => {
    const { service, prisma } = createService();
    const user = { id: "user-1", email: "member@example.com" };
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update
      .mockResolvedValueOnce({ ...user, role: UserRole.MANAGER })
      .mockResolvedValueOnce({ ...user, isActive: false });

    await expect(
      service.updateRole(user.id, UserRole.MANAGER),
    ).resolves.toMatchObject({ role: UserRole.MANAGER });
    await expect(service.updateStatus(user.id, false)).resolves.toMatchObject({
      isActive: false,
    });
    expect(prisma.user.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: user.id }, data: { role: UserRole.MANAGER } }),
    );
    expect(prisma.user.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: user.id }, data: { isActive: false } }),
    );
  });

  it.each([
    ["updateRole", UserRole.ADMIN],
    ["updateStatus", false],
  ] as const)("rejects %s for missing users", async (method, argument) => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(null);

    const action =
      method === "updateRole"
        ? service.updateRole("missing", argument as UserRole)
        : service.updateStatus("missing", argument as boolean);

    await expect(action).rejects.toThrow("User not found");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
