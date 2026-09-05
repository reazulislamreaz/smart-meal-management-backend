import { Test, TestingModule } from "@nestjs/testing";
import { PantryService } from "./pantry.service";
import { PrismaService } from "@/database/prisma.service";
import { NotFoundException } from "@nestjs/common";

describe("PantryService", () => {
  let service: PantryService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      pantryItem: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PantryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PantryService>(PantryService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should successfully create a pantry item WITHOUT an expiry date (optional)", async () => {
    const mockCreated = {
      id: "pantry-1",
      userId: "user-123",
      ingredientName: "Olive Oil",
      category: "Pantry Staples",
      quantity: 1.0,
      unit: "bottle",
      isLowStock: false,
      expiryDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrismaService.pantryItem.create.mockResolvedValue(mockCreated);

    const result = await service.addPantryItem("user-123", {
      ingredientName: "Olive Oil",
      category: "Pantry Staples",
      quantity: 1.0,
      unit: "bottle",
    });

    expect(mockPrismaService.pantryItem.create).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        ingredientName: "Olive Oil",
        category: "Pantry Staples",
        quantity: 1.0,
        unit: "bottle",
        isLowStock: false,
        expiryDate: null,
      },
    });
    expect(result.expiryDate).toBeNull();
  });

  it("should successfully create a pantry item WITH an expiry date when provided", async () => {
    const targetDate = new Date("2027-01-01T00:00:00.000Z");
    const mockCreated = {
      id: "pantry-2",
      userId: "user-123",
      ingredientName: "Milk",
      category: "Dairy",
      quantity: 2.0,
      unit: "L",
      isLowStock: false,
      expiryDate: targetDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrismaService.pantryItem.create.mockResolvedValue(mockCreated);

    const result = await service.addPantryItem("user-123", {
      ingredientName: "Milk",
      category: "Dairy",
      quantity: 2.0,
      unit: "L",
      expiryDate: "2027-01-01T00:00:00.000Z",
    });

    expect(mockPrismaService.pantryItem.create).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        ingredientName: "Milk",
        category: "Dairy",
        quantity: 2.0,
        unit: "L",
        isLowStock: false,
        expiryDate: targetDate,
      },
    });
    expect(result.expiryDate).toEqual(targetDate);
  });

  it("should update a pantry item and allow clearing the expiry date to null", async () => {
    mockPrismaService.pantryItem.findFirst.mockResolvedValue({
      id: "pantry-2",
      userId: "user-123",
      ingredientName: "Milk",
      expiryDate: new Date("2027-01-01T00:00:00.000Z"),
    });

    mockPrismaService.pantryItem.update.mockResolvedValue({
      id: "pantry-2",
      userId: "user-123",
      ingredientName: "Almond Milk",
      expiryDate: null,
    });

    const result = await service.updatePantryItem("user-123", "pantry-2", {
      ingredientName: "Almond Milk",
      expiryDate: "", // empty string clears expiry date to null
    });

    expect(mockPrismaService.pantryItem.update).toHaveBeenCalledWith({
      where: { id: "pantry-2" },
      data: {
        ingredientName: "Almond Milk",
        expiryDate: null,
      },
    });
    expect(result.expiryDate).toBeNull();
  });

  it("should automatically sync onboarding pantry staples when getUserPantry is called", async () => {
    mockPrismaService.user = {
      findUnique: jest.fn().mockResolvedValue({
        id: "user-123",
        pantryStaples: ["Olive Oil", "Pasta", "Garlic"],
      }),
    };
    mockPrismaService.pantryItem.findMany.mockResolvedValue([]);
    mockPrismaService.pantryItem.count.mockResolvedValue(0);
    mockPrismaService.pantryItem.createMany = jest
      .fn()
      .mockResolvedValue({ count: 3 });

    await service.getUserPantry("user-123", { page: 1 });

    expect(mockPrismaService.pantryItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          ingredientName: "Olive Oil",
          category: "Pantry Staples",
          unit: "bottle",
        }),
        expect.objectContaining({
          ingredientName: "Pasta",
          category: "Pantry Staples",
          unit: "kg",
        }),
        expect.objectContaining({
          ingredientName: "Garlic",
          category: "Produce",
          unit: "pcs",
        }),
      ]),
    });
  });
});
