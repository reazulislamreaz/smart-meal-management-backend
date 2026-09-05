import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { UsersRepository } from "./users.repository";
import { PrismaService } from "@/database/prisma.service";

describe("UsersService", () => {
  let service: UsersService;
  let mockUsersRepository: any;
  let mockPrismaService: any;

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    passwordHash: "hash",
    name: "Test User",
    pantryStaples: ["Eggs", "Milk"],
    onboardingStep: 7,
    isOnboardingCompleted: false,
  };

  beforeEach(async () => {
    mockUsersRepository = {
      findById: jest.fn().mockResolvedValue(mockUser),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockImplementation((id, data) =>
        Promise.resolve({
          ...mockUser,
          ...data,
        }),
      ),
      delete: jest.fn(),
    };

    mockPrismaService = {
      pantryItem: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should carry onboarding-selected pantry staples directly into pantry_items table during updateOnboarding", async () => {
    const result = await service.updateOnboarding("user-123", {
      onboardingStep: 7,
      pantryStaples: ["Olive Oil", "Basmati Rice", "Eggs"],
    });

    expect(mockUsersRepository.update).toHaveBeenCalled();
    expect(mockPrismaService.pantryItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: "user-123",
          ingredientName: "Olive Oil",
          unit: "bottle",
        }),
        expect.objectContaining({
          userId: "user-123",
          ingredientName: "Basmati Rice",
          unit: "kg",
        }),
        expect.objectContaining({
          userId: "user-123",
          ingredientName: "Eggs",
          category: "Dairy",
        }),
      ]),
    });
  });

  it("should not create duplicate pantry items if item already exists in pantry", async () => {
    mockPrismaService.pantryItem.findMany.mockResolvedValue([
      { id: "pantry-1", userId: "user-123", ingredientName: "Olive Oil" },
    ]);

    await service.syncOnboardingPantryItems("user-123", [
      "Olive Oil",
      "Black Beans",
    ]);

    expect(mockPrismaService.pantryItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "user-123",
          ingredientName: "Black Beans",
          category: "Pantry Staples",
          unit: "can",
        }),
      ],
    });
  });

  it("should synchronize pantry items on completeOnboarding", async () => {
    mockPrismaService.pantryItem.findMany.mockResolvedValue([]);

    await service.completeOnboarding("user-123", {
      pantryStaples: ["Cheddar Cheese", "Apples"],
    });

    expect(mockPrismaService.pantryItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          ingredientName: "Cheddar Cheese",
          category: "Dairy",
        }),
        expect.objectContaining({
          ingredientName: "Apples",
          category: "Produce",
        }),
      ]),
    });
  });
});
