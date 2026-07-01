import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import AIInsight from "../models/AIInsight.js";
import { chatCompletion, SYSTEM_PROMPTS } from "../utils/aiService.js";
import { lastNDays, calcStreak, todayKey } from "../utils/dateHelpers.js";

// --- Helper Functions ---
const buildWeeklyContext = async (userId) => {
  const habits = await Habit.find({ userId, isArchived: false });
  const days = lastNDays(7);
  const logs = await HabitLog.find({
    userId,
    completedDate: { $gte: days[0], $lte: days[days.length - 1] },
  });

  const perHabit = habits.map((h) => {
    const completed = logs.filter(
      (l) => String(l.habitId) === String(h._id)
    ).length;

    return {
      name: h.name,
      category: h.category,
      frequency: h.frequency,
      completedDays: completed,
      targetDays: h.targetDays,
    };
  });

  return { days, perHabit };
};

// --- Controller Methods ---

export const generateWeeklyReport = async (req, res) => {
  try {
    const ctx = await buildWeeklyContext(req.user._id);

    if (!ctx.perHabit.length) {
      return res.status(400).json({
        message: "No active habits yet. Create your first habit to start tracking - I'll generate a weekly report once you have some data.",
      });
    }

    let userMsg = `Here is my habit data for the past 7 days from ${ctx.days[0]} to ${ctx.days[6]}:\n\n`;

    ctx.perHabit.forEach((h) => {
      userMsg += `- ${h.name} (${h.category}, ${h.frequency}): completed ${h.completedDays} of the past 7 days, target ${h.targetDays}/week\n`;
    });

    userMsg += "\nPlease generate my personalized weekly report now.";

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.weekly,
      user: userMsg,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "weekly",
      content,
    });

    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const suggestHabits = async (req, res) => {
  try {
    const { goals, productiveTime, struggles } = req.body;

    const userMsg = `User goals: ${goals || "not provided"}\nMost productive time: ${productiveTime || "not provided"}\nPast struggles: ${struggles || "not provided"}\n\nSuggest 3 personalised habits now. Return JSON only.`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.suggestion,
      user: userMsg,
    });

    let suggestions = [];
    try {
      const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
      suggestions = parsed.suggestions || [];
    } catch {
      suggestions = [];
    }

    if (!suggestions.length) {
      suggestions = [
        {
          name: "10-minute morning walk",
          description: "Start the day with light movement and fresh air.",
          frequency: "daily",
          category: "Fitness",
          icon: "🚶",
          reason: "Low-friction way to build consistency early in the day.",
        },
        {
          name: "Read 5 pages",
          description: "Short daily reading to build a learning routine.",
          frequency: "daily",
          category: "Learning",
          icon: "📚",
          reason: "Compounds into significant knowledge over weeks.",
        },
        {
          name: "2 minutes of mindful breathing",
          description: "Pause and breathe to reset focus and reduce stress.",
          frequency: "daily",
          category: "Mindfulness",
          icon: "🧘",
          reason: "Tiny anchor habit that fits any schedule.",
        },
      ];
    }

    await AIInsight.create({
      userId: req.user._id,
      type: "suggestion",
      content: JSON.stringify(suggestions),
      meta: { goals, productiveTime, struggles },
    });

    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const recoveryPlan = async (req, res) => {
  try {
    const { habitId } = req.body;
    const habit = await Habit.findOne({
      _id: habitId,
      userId: req.user._id,
    });

    if (!habit) return res.status(404).json({ message: "Habit not found" });

    const logs = await HabitLog.find({
      userId: req.user._id,
      habitId,
    }).sort({ completedDate: -1 });

    const keys = logs.map((l) => l.completedDate);
    const { longest } = calcStreak(keys);

    const userMsg = `Habit: ${habit.name} (${habit.category}).\nDescription: ${habit.description || "none"}.\nLongest ever: ${longest} days. The user just broke a streak. Write a warm, actionable 3-day recovery plan.`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.recovery,
      user: userMsg,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "recovery",
      content,
      meta: { habitId },
    });

    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const chatAnalysis = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        message: "Question is required",
      });
    }

    // Get all active habits
    const habits = await Habit.find({
      userId: req.user._id,
      isArchived: false,
    });

    // Get logs from the last 30 days
    const days = lastNDays(30);

    const logs = await HabitLog.find({
      userId: req.user._id,
      completedDate: {
        $gte: days[0],
        $lte: days[days.length - 1],
      },
    });

    // Build AI context
    const context = habits
      .map((habit) => {
        const habitLogs = logs.filter(
          (log) => String(log.habitId) === String(habit._id)
        );

        // Count completions by weekday
        // [Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday]
        const byDow = Array(7).fill(0);

        habitLogs.forEach((log) => {
          const day = new Date(log.completedDate).getDay();
          byDow[day]++;
        });

        return `
Habit: ${habit.name}
Category: ${habit.category}
Frequency: ${habit.frequency}
Completed: ${habitLogs.length} times in the last 30 days
Weekday distribution:
Sun: ${byDow[0]}
Mon: ${byDow[1]}
Tue: ${byDow[2]}
Wed: ${byDow[3]}
Thu: ${byDow[4]}
Fri: ${byDow[5]}
Sat: ${byDow[6]}
`;
      })
      .join("\n");

    const userMsg = `
User Question:
${question}

User Habit Data:
${context}

Please analyze the user's habits and answer the question using the data above.
`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.chat,
      user: userMsg,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "chat",
      content,
      meta: {
        question,
      },
    });

    return res.json({
      content,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: err.message,
    });
  }
};

export const morningMotivation = async (req, res) => {
  try {
    const habits = await Habit.find({
      userId: req.user._id,
      isArchived: false,
    });

    if (!habits.length) {
      return res.json({
        content: "Good morning! Add your first habit today and let's get the momentum started.",
      });
    }

    const days = lastNDays(30);
    const logs = await HabitLog.find({
      userId: req.user._id,
      completedDate: { $gte: days[0], $lte: days[days.length - 1] },
    });

    const ctx = habits
      .map((h) => {
        const hLogs = logs
          .filter((l) => String(l.habitId) === String(h._id))
          .map((l) => l.completedDate)
          .sort()
          .reverse();

        const { current } = calcStreak(hLogs);
        return `${h.name}: current streak ${current}`;
      })
      .join("\n");

    const today = todayKey();
    const todayLogs = logs.filter((l) => l.completedDate === today);
    const done = todayLogs.length;
    const total = habits.length;

    const userMsg = `Today's habits and streaks:\n${ctx}\n\nDone today: ${done}/${total}. Write the morning motivation message now.`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.morning,
      user: userMsg,
      temperature: 0.8,
    });

    await AIInsight.create({
      userId: req.user._id,
      type: "morning",
      content,
    });

    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
