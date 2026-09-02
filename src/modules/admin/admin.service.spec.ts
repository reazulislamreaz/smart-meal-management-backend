import { Test, TestingModule } from "@nestjs/testing";
import { AdminService } from "./admin.service";
import { PrismaService } from "@/database/prisma.service";
import { Role } from "@prisma/client";

describe("AdminService", () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      count: jest.fn().mockResolvedValue(100),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({
        id: "user-1",
        email: "admin@sizzl.com",
        name: "Admin",
        role: Role.SUPER_ADMIN,
      }),
      create: jest
        .fn()
        .mockResolvedValue({ id: "user-1", email: "test@example.com" }),
      update: jest
        .fn()
        .mockResolvedValue({ id: "user-1", role: Role.SUPER_ADMIN }),
      delete: jest.fn().mockResolvedValue({ id: "user-1" }),
    },
    subscription: {
      count: jest.fn().mockResolvedValue(25),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: "sub-1", planName: "Monthly Premium" }),
      create: jest
        .fn()
        .mockResolvedValue({ id: "sub-1", planName: "Annual Plan" }),
      update: jest.fn().mockResolvedValue({ id: "sub-1", status: "ACTIVE" }),
      groupBy: jest
        .fn()
        .mockResolvedValue([
          { planName: "Monthly Premium", _count: { id: 15 } },
        ]),
    },
    subscriptionPlan: {
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([
        {
          id: "plan-1",
          name: "Monthly Premium",
          price: 7.99,
          isActive: true,
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: "plan-1",
        name: "Monthly Premium",
        price: 7.99,
      }),
      create: jest
        .fn()
        .mockResolvedValue({ id: "plan-2", name: "Family Tier", price: 14.99 }),
      update: jest.fn().mockResolvedValue({ id: "plan-1", price: 8.99 }),
      delete: jest.fn().mockResolvedValue({ id: "plan-1" }),
    },
    meal: {
      count: jest.fn().mockResolvedValue(50),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: "meal-1", title: "Chicken Salad" }),
      create: jest
        .fn()
        .mockResolvedValue({ id: "meal-2", title: "Salmon Bowl" }),
      update: jest
        .fn()
        .mockResolvedValue({ id: "meal-1", title: "Updated Chicken Salad" }),
      delete: jest.fn().mockResolvedValue({ id: "meal-1" }),
    },
    coupon: {
      count: jest.fn().mockResolvedValue(5),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: "coup-1", code: "SAVE20", redemptions: [] }),
      create: jest.fn().mockResolvedValue({
        id: "coup-2",
        code: "SAVE30",
        discountPercent: 30,
      }),
      update: jest
        .fn()
        .mockResolvedValue({ id: "coup-1", discountPercent: 25 }),
      delete: jest.fn().mockResolvedValue({ id: "coup-1" }),
    },
    cookbookLog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    contactMessage: {
      count: jest.fn().mockResolvedValue(10),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: "msg-1", name: "John Doe", status: "UNREAD" }),
      create: jest.fn().mockResolvedValue({ id: "msg-1", name: "John Doe" }),
      update: jest.fn().mockResolvedValue({ id: "msg-1", status: "RESOLVED" }),
      delete: jest.fn().mockResolvedValue({ id: "msg-1" }),
    },
    systemSetting: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ key: "config_trialDays", value: "7" }]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest
        .fn()
        .mockResolvedValue({ key: "defaultCurrency", value: "USD" }),
    },
    staticPage: {
      findUnique: jest.fn().mockResolvedValue({ content: "Test content" }),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(12),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should return analytics KPIs", async () => {
    const analytics = await service.getAnalytics();
    expect(analytics.totalUsers).toBe(100);
    expect(analytics.activeSubscriptions).toBe(25);
    expect(analytics.grossRevenue).toBeGreaterThan(0);
    expect(analytics.netMRR).toBeGreaterThan(0);
  });

  it("should list subscription plans with active subscribers count", async () => {
    const plans = await service.listSubscriptionPlans();
    expect(plans).toBeDefined();
    expect(plans.length).toBe(1);
    expect(plans[0].activeSubscribersCount).toBe(15);
  });

  it("should create a subscription plan", async () => {
    (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValueOnce(
      null,
    );
    const plan = await service.createSubscriptionPlan({
      name: "Family Tier",
      price: 14.99,
      interval: "monthly",
    });
    expect(plan.id).toBe("plan-2");
  });

  it("should assign a subscription to a user", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
    });
    const sub = await service.assignSubscription({
      userId: "user-1",
      planName: "Annual Plan",
      durationDays: 365,
    });
    expect(sub).toBeDefined();
    expect(sub.id).toBe("sub-1");
  });

  it("should update contact inquiry status", async () => {
    const msg = await service.updateContactStatus("msg-1", "RESOLVED");
    expect(msg.status).toBe("RESOLVED");
  });

  it("should get and upsert platform settings", async () => {
    const settings = await service.getSettings();
    expect(settings.profile).toBeDefined();
    expect(settings.appConfig).toBeDefined();

    const updated = await service.upsertSetting({
      key: "defaultCurrency",
      value: "USD",
    });
    expect(updated.value).toBe("USD");
  });
});
