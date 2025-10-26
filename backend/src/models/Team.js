const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Member name is required"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Member email is required"],
    lowercase: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ["manager", "member"],
    default: "member",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
      unique: true,
      maxlength: [100, "Team name cannot be more than 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot be more than 500 characters"],
    },
    budget: {
      type: Number,
      required: [true, "Budget is required"],
      min: [0, "Budget must be a positive number"],
    },
    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "EUR", "GBP", "CAD"],
    },
    members: [teamMemberSchema],
    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    alertsSent: {
      warning: {
        type: Boolean,
        default: false,
      },
      critical: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for budget utilization percentage
teamSchema.virtual("budgetUtilization").get(function () {
  return this.budget > 0
    ? Math.round((this.totalSpent / this.budget) * 100)
    : 0;
});

// Virtual for remaining budget
teamSchema.virtual("remainingBudget").get(function () {
  return Math.max(0, this.budget - this.totalSpent);
});

// Virtual for budget status
teamSchema.virtual("budgetStatus").get(function () {
  const utilization = this.budgetUtilization;
  if (utilization >= 100) return "over-budget";
  if (utilization >= 80) return "warning";
  if (utilization >= 60) return "moderate";
  return "good";
});

// Indexes for better query performance
teamSchema.index({ name: 1 });
teamSchema.index({ createdBy: 1 });
teamSchema.index({ isActive: 1 });
teamSchema.index({ "members.email": 1 });

// Pre-save middleware to ensure totalSpent doesn't go negative
teamSchema.pre("save", function (next) {
  if (this.totalSpent < 0) {
    this.totalSpent = 0;
  }
  next();
});

// Method to add member to team
teamSchema.methods.addMember = function (memberData) {
  const existingMember = this.members.find(
    (member) => member.email.toLowerCase() === memberData.email.toLowerCase()
  );

  if (existingMember) {
    throw new Error("Member with this email already exists in the team");
  }

  this.members.push(memberData);
  return this.save();
};

// Method to remove member from team
teamSchema.methods.removeMember = function (memberId) {
  this.members.id(memberId).remove();
  return this.save();
};

// Method to update total spent amount
teamSchema.methods.updateTotalSpent = async function () {
  const Expense = mongoose.model("Expense");
  const result = await Expense.aggregate([
    {
      $match: {
        team: this._id,
        status: "approved",
        isActive: true,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  this.totalSpent = result.length > 0 ? result[0].total : 0;
  return this.save();
};

// Static method to find teams by budget utilization
teamSchema.statics.findByBudgetUtilization = function (threshold) {
  return this.find({
    isActive: true,
    $expr: {
      $gte: [
        { $multiply: [{ $divide: ["$totalSpent", "$budget"] }, 100] },
        threshold,
      ],
    },
  });
};

const Team = mongoose.model("Team", teamSchema);

module.exports = Team;
