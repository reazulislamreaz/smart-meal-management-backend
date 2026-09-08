import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { OpenAiService, GeneratePlanOptions } from "./openai.service";

const mockCreate = jest.fn();

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

const CONFIG: Record<string, unknown> = {
  CHATGPT_OPENAI_KEY: "sk-test-key",
  OPENAI_MODEL: "gpt-4o-mini",
  OPENAI_TIMEOUT_MS: 120000,
  OPENAI_MAX_RETRIES: 2,
  OPENAI_MAX_MEALS_PER_REQUEST: 7,
  OPENAI_MAX_PARALLEL_REQUESTS: 8,
};

type Slot = { dayOfWeek: number; mealType: string };

function buildSlots(perType: Record<string, number>): Slot[] {
  const slots: Slot[] = [];
  for (const [mealType, count] of Object.entries(perType)) {
    for (let i = 0; i < count; i++) {
      slots.push({ dayOfWeek: (i % 7) + 1, mealType });
    }
  }
  return slots;
}

function buildOptions(
  slots: Slot[] | undefined,
  weeklyBudget = 210,
): GeneratePlanOptions {
  const frequency = {
    breakfast: (slots ?? []).filter((s) => s.mealType === "BREAKFAST").length,
    lunch: (slots ?? []).filter((s) => s.mealType === "LUNCH").length,
    dinner: (slots ?? []).filter((s) => s.mealType === "DINNER").length,
  };

  return {
    user: {
      id: "user-1",
      weeklyBudget,
      adultsCount: 2,
      childrenCount: 2,
      dietaryRestrictions: [],
      cuisinePreferences: [],
      kitchenEquipment: [],
      pantryStaples: [],
      mealVibes: [],
      plannedMealTypes: ["BREAKFAST", "LUNCH", "DINNER"],
      plannedDaysCount: 7,
      currency: "USD",
    },
    overrides: {
      daysCount: 7,
      mealFrequency: frequency,
      ...(slots ? { mealSlots: slots } : {}),
      weeklyBudget,
    },
  };
}

/** Reads back the slot schedule the service rendered into a prompt. */
function slotsFromPrompt(prompt: string): Slot[] {
  const slots: Slot[] = [];
  const pattern = /^\s*\d+\. Day (\d+), ([A-Z]+)\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(prompt)) !== null) {
    slots.push({ dayOfWeek: Number(match[1]), mealType: match[2] });
  }

  return slots;
}

function promptOf(call: any): string {
  const messages = call[0].messages;
  return messages[messages.length - 1].content;
}

function completion(slots: Slot[], startIndex: number) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            planTitle: `Plan ${startIndex}`,
            planOverview: `Overview ${startIndex}`,
            dailyTargetCalories: 2000,
            totalEstimatedCost: slots.length * 10,
            meals: slots.map((slot, index) => ({
              title: `Meal ${startIndex + index}`,
              description: "Test meal",
              dayOfWeek: slot.dayOfWeek,
              mealType: slot.mealType,
              prepTimeMinutes: 20,
              servings: 4,
              estimatedCost: 10,
              cuisine: "American",
              dietaryTags: [],
              instructions: ["Cook it"],
              ingredients: [],
            })),
          }),
        },
      },
    ],
  };
}

describe("OpenAiService", () => {
  let service: OpenAiService;
  let mealCounter: number;

  /** Answers each request with exactly the meals its slot schedule asked for. */
  function respondWithRequestedSlots(drop?: { mealType: string }) {
    let dropped = false;

    mockCreate.mockImplementation((body: any) => {
      const messages = body.messages;
      const slots = slotsFromPrompt(messages[messages.length - 1].content);

      if (drop && !dropped) {
        const index = slots.findIndex((s) => s.mealType === drop.mealType);
        if (index >= 0) {
          slots.splice(index, 1);
          dropped = true;
        }
      }

      const response = completion(slots, mealCounter);
      mealCounter += slots.length;
      return Promise.resolve(response);
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mealCounter = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAiService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => CONFIG[key]) },
        },
      ],
    }).compile();

    service = module.get<OpenAiService>(OpenAiService);
  });

  it("sends a single request for a plan that fits one request", async () => {
    respondWithRequestedSlots();

    const result = await service.generateMealPlan(
      buildOptions(buildSlots({ DINNER: 7 })),
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.meals).toHaveLength(7);
    expect(promptOf(mockCreate.mock.calls[0])).not.toContain(
      "SEGMENTED GENERATION CONTEXT",
    );
  });

  it("keeps the single-request path when no slot schedule is provided", async () => {
    // Without slot assignments there is nothing to partition on, so the whole plan
    // must still go out as one request.
    mockCreate.mockResolvedValue(
      completion(buildSlots({ BREAKFAST: 7, LUNCH: 7, DINNER: 7 }), 0),
    );

    const result = await service.generateMealPlan(buildOptions(undefined));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.meals).toHaveLength(21);
  });

  it("splits a larger plan into one concurrent request per meal type", async () => {
    respondWithRequestedSlots();

    const result = await service.generateMealPlan(
      buildOptions(buildSlots({ BREAKFAST: 7, LUNCH: 7, DINNER: 7 })),
    );

    expect(mockCreate).toHaveBeenCalledTimes(3);

    const requested = mockCreate.mock.calls.map((call) =>
      slotsFromPrompt(promptOf(call)),
    );
    expect(requested.map((slots) => slots.length)).toEqual([7, 7, 7]);
    expect(
      requested.map((slots) => new Set(slots.map((s) => s.mealType)).size),
    ).toEqual([1, 1, 1]);

    // Every requested slot is generated exactly once, with no duplicated meals.
    expect(result.meals).toHaveLength(21);
    expect(new Set(result.meals.map((m) => m.title)).size).toBe(21);
  });

  it("splits the budget proportionally so segment costs sum back to the target", async () => {
    respondWithRequestedSlots();

    const result = await service.generateMealPlan(
      buildOptions(buildSlots({ BREAKFAST: 7, LUNCH: 7, DINNER: 7 }), 210),
    );

    for (const call of mockCreate.mock.calls) {
      expect(promptOf(call)).toContain("USD 70.00");
    }
    expect(result.totalEstimatedCost).toBe(210);
  });

  it("re-requests only the unfilled slots when the model returns too few meals", async () => {
    respondWithRequestedSlots({ mealType: "LUNCH" });

    const result = await service.generateMealPlan(
      buildOptions(buildSlots({ BREAKFAST: 7, LUNCH: 7, DINNER: 7 })),
    );

    // Three segments, then one short follow-up for the single missing lunch.
    expect(mockCreate).toHaveBeenCalledTimes(4);

    const backfilled = slotsFromPrompt(promptOf(mockCreate.mock.calls[3]));
    expect(backfilled).toHaveLength(1);
    expect(backfilled[0].mealType).toBe("LUNCH");

    expect(result.meals).toHaveLength(21);
    expect(result.meals.filter((m) => m.mealType === "LUNCH")).toHaveLength(7);
  });

  it("returns what the model produced when a backfill still comes up short", async () => {
    let call = 0;
    mockCreate.mockImplementation((body: any) => {
      const messages = body.messages;
      const slots = slotsFromPrompt(messages[messages.length - 1].content);
      // Always one short, so the single backfill round cannot close the gap.
      const served = call++ === 0 ? slots.slice(0, -1) : [];
      const response = completion(served, mealCounter);
      mealCounter += served.length;
      return Promise.resolve(response);
    });

    await expect(
      service.generateMealPlan(buildOptions(buildSlots({ DINNER: 7 }))),
    ).rejects.toThrow(/missing valid meals array/);

    // One generation plus a single backfill attempt: no unbounded retry loop.
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
